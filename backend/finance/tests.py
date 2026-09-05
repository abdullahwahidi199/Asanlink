from datetime import date
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.constants import ADMIN_ROLE_NAME
from accounts.models import Role, User
from accounts.services import seed_authorization

from .models import Contribution, Expense, ExpenseCategory, ExpenseEvent, RecurringExpense, Settlement
from .services import calculate_member_balances, dashboard_data, generate_due_expenses, settlement_recommendations


PASSWORD = "ValidPassword!234"


class FinanceAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_authorization(reset_defaults=True)
        cls.admin_role = Role.objects.get(name=ADMIN_ROLE_NAME)
        cls.manager_role = Role.objects.get(name="MANAGER")
        cls.restricted_role = Role.objects.create(name="FINANCE_RESTRICTED")
        cls.admin = User.objects.create_user(
            username="finance-admin", email="finance-admin@example.com", password=PASSWORD,
            first_name="Finance", last_name="Admin", role=cls.admin_role,
        )
        cls.abdullah = User.objects.create_user(
            username="abdullah", email="abdullah@example.com", password=PASSWORD,
            first_name="Abdullah", last_name="Founder", role=cls.manager_role,
        )
        cls.ahmad = User.objects.create_user(
            username="ahmad", email="ahmad@example.com", password=PASSWORD,
            first_name="Ahmad", last_name="Founder", role=cls.manager_role,
        )
        cls.restricted = User.objects.create_user(
            username="restricted-finance", email="restricted-finance@example.com",
            password=PASSWORD, role=cls.restricted_role,
        )
        cls.category = ExpenseCategory.objects.get(slug="other")

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def expense_payload(self, **overrides):
        payload = {
            "paid_by_id": self.abdullah.pk,
            "amount": "125.50",
            "currency": "USD",
            "date": "2026-08-15",
            "category_id": self.category.pk,
            "description": "Production hosting",
            "vendor": "Hosting vendor",
            "project": "Asanlink",
            "product": "Platform",
            "payment_source": "COMPANY",
            "notes": "August invoice",
        }
        payload.update(overrides)
        return payload

    def create_final_expense(self, **overrides):
        values = {
            "paid_by": self.abdullah,
            "amount": Decimal("100.00"),
            "currency": "USD",
            "date": date(2026, 8, 15),
            "category": self.category,
            "description": "Company expense",
            "payment_source": Expense.PaymentSource.COMPANY,
            "status": Expense.Status.PAID,
            "created_by": self.admin,
            "updated_by": self.admin,
        }
        values.update(overrides)
        return Expense.objects.create(**values)

    def test_expense_creation_is_draft_audited_and_rejects_impossible_amount(self):
        response = self.client.post(reverse("finance-expense-list"), self.expense_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        expense = Expense.objects.get(pk=response.data["id"])
        self.assertEqual(expense.amount, Decimal("125.50"))
        self.assertEqual(expense.status, Expense.Status.DRAFT)
        event = ExpenseEvent.objects.get(expense=expense)
        self.assertEqual(event.to_status, Expense.Status.DRAFT)
        self.assertEqual(event.actor, self.admin)

        response = self.client.post(
            reverse("finance-expense-list"), self.expense_payload(amount="0.00"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("amount", response.data["error"]["details"])

    def test_expense_workflow_enforces_transitions_rejection_reason_and_payment_source(self):
        created = self.client.post(
            reverse("finance-expense-list"),
            self.expense_payload(payment_source="PERSONAL"),
            format="json",
        ).data
        expense_id = created["id"]
        response = self.client.post(reverse("finance-expense-approve", args=(expense_id,)), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.assertEqual(
            self.client.post(reverse("finance-expense-submit", args=(expense_id,)), {}, format="json").status_code,
            status.HTTP_200_OK,
        )
        response = self.client.post(reverse("finance-expense-reject", args=(expense_id,)), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(
            reverse("finance-expense-reject", args=(expense_id,)),
            {"note": "Receipt total is unclear."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.client.post(reverse("finance-expense-submit", args=(expense_id,)), {}, format="json")
        self.client.post(reverse("finance-expense-approve", args=(expense_id,)), {}, format="json")
        response = self.client.post(reverse("finance-expense-record-payment", args=(expense_id,)), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["status"], Expense.Status.RECORDED)
        self.assertEqual(ExpenseEvent.objects.filter(expense_id=expense_id).count(), 6)

    def test_approval_and_finance_visibility_are_backend_authorized(self):
        expense = Expense.objects.create(
            paid_by=self.abdullah, amount=Decimal("10"), currency="USD", date=date(2026, 8, 1),
            category=self.category, description="Submitted", payment_source=Expense.PaymentSource.COMPANY,
            status=Expense.Status.SUBMITTED, created_by=self.admin, updated_by=self.admin,
        )
        self.client.force_authenticate(self.abdullah)
        self.assertEqual(
            self.client.post(reverse("finance-expense-approve", args=(expense.pk,)), {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.restricted)
        self.assertEqual(self.client.get(reverse("finance-dashboard")).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("finance-dashboard")).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_contributions_and_balances_remain_currency_separated(self):
        Contribution.objects.bulk_create([
            Contribution(member=self.abdullah, amount=Decimal("1000"), currency="USD", date=date(2026, 8, 1), description="USD capital", created_by=self.admin),
            Contribution(member=self.ahmad, amount=Decimal("500"), currency="USD", date=date(2026, 8, 1), description="USD capital", created_by=self.admin),
            Contribution(member=self.abdullah, amount=Decimal("7000"), currency="AFN", date=date(2026, 8, 1), description="AFN capital", created_by=self.admin),
            Contribution(member=self.ahmad, amount=Decimal("1000"), currency="AFN", date=date(2026, 8, 1), description="AFN capital", created_by=self.admin),
        ])
        self.create_final_expense(
            paid_by=self.ahmad, amount=Decimal("100"), payment_source=Expense.PaymentSource.PERSONAL,
            status=Expense.Status.RECORDED, description="Personally paid hosting",
        )
        balances = calculate_member_balances()
        indexed = {(row["member"]["id"], row["currency"]): row for row in balances}
        self.assertEqual(indexed[(self.abdullah.pk, "USD")]["amount_receivable"], "200.00")
        self.assertEqual(indexed[(self.ahmad.pk, "USD")]["amount_owed"], "200.00")
        self.assertEqual(indexed[(self.abdullah.pk, "AFN")]["amount_receivable"], "3000.00")
        self.assertEqual(indexed[(self.ahmad.pk, "AFN")]["amount_owed"], "3000.00")
        recommendations = settlement_recommendations()
        self.assertSetEqual({(item["currency"], item["amount"]) for item in recommendations}, {("USD", "200.00"), ("AFN", "3000.00")})

    def test_paid_settlement_adjusts_positions_without_manual_balance_fields(self):
        Contribution.objects.create(
            member=self.abdullah, amount=Decimal("1000"), currency="USD", date=date(2026, 8, 1),
            description="Capital", created_by=self.admin,
        )
        Contribution.objects.create(
            member=self.ahmad, amount=Decimal("500"), currency="USD", date=date(2026, 8, 1),
            description="Capital", created_by=self.admin,
        )
        overpayment = self.client.post(reverse("finance-settlement-record"), {
            "payer_id": self.ahmad.pk,
            "receiver_id": self.abdullah.pk,
            "amount": "251.00",
            "currency": "USD",
            "date": "2026-08-20",
            "reason": "Too much",
        }, format="json")
        self.assertEqual(overpayment.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(reverse("finance-settlement-record"), {
            "payer_id": self.ahmad.pk,
            "receiver_id": self.abdullah.pk,
            "amount": "250.00",
            "currency": "USD",
            "date": "2026-08-20",
            "reason": "Equalize member funding",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], Settlement.Status.PAID)
        self.assertEqual(settlement_recommendations(), [])

    def test_cash_flow_excludes_personal_expenses_but_total_spend_includes_them(self):
        Contribution.objects.create(
            member=self.abdullah, amount=Decimal("1000"), currency="USD", date=date(2026, 8, 1),
            description="Capital", created_by=self.admin,
        )
        self.create_final_expense(amount=Decimal("300"), description="Company funded")
        self.create_final_expense(
            amount=Decimal("200"), description="Personal funded", payment_source=Expense.PaymentSource.PERSONAL,
            status=Expense.Status.RECORDED,
        )
        data = dashboard_data()
        self.assertEqual(data["summary"]["total_expenses"]["USD"], "500.00")
        self.assertEqual(data["summary"]["company_expenses"]["USD"], "300.00")
        self.assertEqual(data["summary"]["personal_expenses"]["USD"], "200.00")
        self.assertEqual(data["summary"]["net_cash_flow"]["USD"], "700.00")

    def test_recurring_generation_is_idempotent_and_keeps_month_end_anchor(self):
        rule = RecurringExpense.objects.create(
            name="Hosting", amount=Decimal("50"), currency="USD", category=self.category,
            vendor="Vendor", frequency=RecurringExpense.Frequency.MONTHLY,
            start_date=date(2026, 1, 31), next_occurrence=date(2026, 1, 31),
            paid_by=self.abdullah, payment_source=RecurringExpense.PaymentSource.COMPANY,
            created_by=self.admin,
        )
        created = generate_due_expenses(rule, date(2026, 3, 31), self.admin)
        self.assertEqual([item.occurrence_date for item in created], [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31)])
        rule.refresh_from_db()
        self.assertEqual(rule.next_occurrence, date(2026, 4, 30))
        self.assertEqual(generate_due_expenses(rule, date(2026, 3, 31), self.admin), [])
        self.assertEqual(Expense.objects.filter(recurring_expense=rule).count(), 3)

    def test_upload_validation_and_filtered_exports(self):
        invalid = SimpleUploadedFile("receipt.exe", b"not safe", content_type="application/octet-stream")
        response = self.client.post(
            reverse("finance-expense-list"),
            self.expense_payload(receipt=invalid),
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("receipt", response.data["error"]["details"])

        self.create_final_expense(description="Hosting August", project="Asanlink")
        self.create_final_expense(description="Marketing August", project="Website")
        response = self.client.get(reverse("finance-export"), {"export_format": "csv", "project": "Asanlink"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode("utf-8-sig")
        self.assertIn("Hosting August", content)
        self.assertNotIn("Marketing August", content)
        response = self.client.get(reverse("finance-export"), {"export_format": "pdf", "project": "Asanlink"})
        self.assertTrue(response.content.startswith(b"%PDF-1.4"))
        self.assertEqual(response["Content-Type"], "application/pdf")

    def test_report_filtering_and_contribution_api(self):
        response = self.client.post(reverse("finance-contribution-list"), {
            "member_id": self.abdullah.pk,
            "amount": "350.25",
            "currency": "AFN",
            "date": "2026-08-01",
            "description": "Operating capital",
            "reference": "BANK-001",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.create_final_expense(currency="AFN", project="Alpha", amount=Decimal("40"))
        self.create_final_expense(currency="AFN", project="Beta", amount=Decimal("90"))
        report = self.client.get(reverse("finance-reports"), {"project": "Alpha", "group_by": "project"})
        self.assertEqual(report.status_code, status.HTTP_200_OK, report.data)
        self.assertEqual(report.data["expense_groups"], [{"key": "Alpha", "label": "Alpha", "currency": "AFN", "amount": "40.00"}])
