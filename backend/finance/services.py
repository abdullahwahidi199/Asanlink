import calendar
import csv
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from io import StringIO

from django.db import transaction
from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth, TruncYear
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Contribution, Currency, Expense, ExpenseEvent, RecurringExpense, Settlement


ZERO = Decimal("0.00")
CENT = Decimal("0.01")
FINANCIAL_EXPENSE_STATUSES = (
    Expense.Status.APPROVED,
    Expense.Status.PAID,
    Expense.Status.RECORDED,
)


def money(value):
    return str((value or ZERO).quantize(CENT, rounding=ROUND_HALF_UP))


def money_totals(rows):
    totals = {currency: ZERO for currency in Currency.values}
    for row in rows:
        totals[row["currency"]] += row["total"] or ZERO
    return {currency: money(total) for currency, total in totals.items()}


def user_summary(user_id, username, first_name, last_name):
    full_name = f"{first_name or ''} {last_name or ''}".strip() or username or "Former member"
    return {
        "id": user_id,
        "username": username or "",
        "full_name": full_name,
        "initials": "".join(part[0] for part in full_name.split()[:2]).upper(),
    }


def _date_filters(queryset, params, field="date"):
    if params.get("date_from"):
        queryset = queryset.filter(**{f"{field}__gte": params["date_from"]})
    if params.get("date_to"):
        queryset = queryset.filter(**{f"{field}__lte": params["date_to"]})
    return queryset


def filter_expenses(queryset, params, *, include_search=True):
    queryset = _date_filters(queryset, params)
    mappings = {
        "currency": "currency",
        "member": "paid_by_id",
        "category": "category_id",
        "status": "status",
        "payment_source": "payment_source",
    }
    for parameter, field in mappings.items():
        if params.get(parameter):
            queryset = queryset.filter(**{field: params[parameter]})
    if params.get("project"):
        queryset = queryset.filter(project__iexact=params["project"])
    if params.get("product"):
        queryset = queryset.filter(product__iexact=params["product"])
    if include_search and params.get("search"):
        search = params["search"].strip()
        queryset = queryset.filter(
            Q(description__icontains=search)
            | Q(vendor__icontains=search)
            | Q(project__icontains=search)
            | Q(product__icontains=search)
            | Q(notes__icontains=search)
            | Q(paid_by__username__icontains=search)
            | Q(paid_by__first_name__icontains=search)
            | Q(paid_by__last_name__icontains=search)
        )
    return queryset


def filter_contributions(queryset, params, *, include_search=True):
    queryset = _date_filters(queryset, params)
    if params.get("currency"):
        queryset = queryset.filter(currency=params["currency"])
    if params.get("member"):
        queryset = queryset.filter(member_id=params["member"])
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if include_search and params.get("search"):
        search = params["search"].strip()
        queryset = queryset.filter(
            Q(description__icontains=search)
            | Q(reference__icontains=search)
            | Q(notes__icontains=search)
            | Q(member__username__icontains=search)
            | Q(member__first_name__icontains=search)
            | Q(member__last_name__icontains=search)
        )
    return queryset


def filter_settlements(queryset, params, *, include_search=True):
    queryset = _date_filters(queryset, params)
    if params.get("currency"):
        queryset = queryset.filter(currency=params["currency"])
    if params.get("member"):
        queryset = queryset.filter(Q(payer_id=params["member"]) | Q(receiver_id=params["member"]))
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if include_search and params.get("search"):
        search = params["search"].strip()
        queryset = queryset.filter(
            Q(reason__icontains=search)
            | Q(payer__username__icontains=search)
            | Q(receiver__username__icontains=search)
        )
    return queryset


@transaction.atomic
def transition_expense(expense, target_status, actor, note=""):
    locked = Expense.objects.select_for_update().get(pk=expense.pk)
    allowed = {
        Expense.Status.DRAFT: {Expense.Status.SUBMITTED},
        Expense.Status.REJECTED: {Expense.Status.SUBMITTED},
        Expense.Status.SUBMITTED: {Expense.Status.APPROVED, Expense.Status.REJECTED},
        Expense.Status.APPROVED: {Expense.Status.PAID, Expense.Status.RECORDED},
    }
    if target_status not in allowed.get(locked.status, set()):
        raise ValidationError(
            {"status": f"An expense cannot move from {locked.get_status_display()} to {target_status.title()}."}
        )
    if target_status == Expense.Status.REJECTED and not note.strip():
        raise ValidationError({"note": "A rejection reason is required."})
    if target_status == Expense.Status.PAID and locked.payment_source != Expense.PaymentSource.COMPANY:
        raise ValidationError({"status": "Personally paid expenses must be recorded, not paid from company funds."})
    if target_status == Expense.Status.RECORDED and locked.payment_source != Expense.PaymentSource.PERSONAL:
        raise ValidationError({"status": "Company-funded expenses must be marked paid."})

    previous = locked.status
    locked.status = target_status
    locked.updated_by = actor
    locked.save(update_fields=("status", "updated_by", "updated_at"))
    ExpenseEvent.objects.create(
        expense=locked,
        from_status=previous,
        to_status=target_status,
        actor=actor,
        note=note.strip(),
    )
    return locked


def calculate_member_balances(params=None):
    params = params or {}
    contributions = filter_contributions(
        Contribution.objects.filter(status=Contribution.Status.RECORDED), params, include_search=False
    )
    expenses = filter_expenses(
        Expense.objects.filter(status__in=FINANCIAL_EXPENSE_STATUSES), params, include_search=False
    )
    settlements = filter_settlements(
        Settlement.objects.filter(
            status__in=(Settlement.Status.PARTIAL, Settlement.Status.PAID),
            settled_amount__gt=0,
        ),
        params,
        include_search=False,
    )

    members = {}
    values = defaultdict(lambda: {
        "contributions": ZERO,
        "personal_expenses": ZERO,
        "company_expenses": ZERO,
        "settlement_adjustment": ZERO,
    })

    contribution_rows = contributions.values(
        "member_id", "member__username", "member__first_name", "member__last_name", "currency"
    ).annotate(total=Sum("amount"))
    for row in contribution_rows:
        member_id = row["member_id"]
        members[member_id] = user_summary(
            member_id, row["member__username"], row["member__first_name"], row["member__last_name"]
        )
        values[(member_id, row["currency"])]["contributions"] += row["total"] or ZERO

    expense_rows = expenses.values(
        "paid_by_id", "paid_by__username", "paid_by__first_name", "paid_by__last_name",
        "currency", "payment_source",
    ).annotate(total=Sum("amount"))
    for row in expense_rows:
        member_id = row["paid_by_id"]
        members[member_id] = user_summary(
            member_id, row["paid_by__username"], row["paid_by__first_name"], row["paid_by__last_name"]
        )
        key = "personal_expenses" if row["payment_source"] == Expense.PaymentSource.PERSONAL else "company_expenses"
        values[(member_id, row["currency"])][key] += row["total"] or ZERO

    for settlement in settlements.select_related("payer", "receiver"):
        for user in (settlement.payer, settlement.receiver):
            members[user.pk] = user_summary(user.pk, user.username, user.first_name, user.last_name)
        values[(settlement.payer_id, settlement.currency)]["settlement_adjustment"] += settlement.settled_amount
        values[(settlement.receiver_id, settlement.currency)]["settlement_adjustment"] -= settlement.settled_amount

    total_contributions = defaultdict(lambda: ZERO)
    total_expenses = defaultdict(lambda: ZERO)
    participants = defaultdict(set)
    for (member_id, currency), item in values.items():
        if item["contributions"] or item["personal_expenses"] or item["settlement_adjustment"]:
            participants[currency].add(member_id)
        total_contributions[currency] += item["contributions"]
        total_expenses[currency] += item["personal_expenses"] + item["company_expenses"]

    result = []
    for currency in Currency.values:
        ids = sorted(participants[currency])
        if not ids:
            continue
        total_funded = sum(
            (values[(member_id, currency)]["contributions"] + values[(member_id, currency)]["personal_expenses"] for member_id in ids),
            ZERO,
        )
        expected_share = total_funded / Decimal(len(ids))
        currency_rows = []
        for member_id in ids:
            item = values[(member_id, currency)]
            gross_funding = item["contributions"] + item["personal_expenses"]
            adjusted_funding = gross_funding + item["settlement_adjustment"]
            net_position = (adjusted_funding - expected_share).quantize(CENT, rounding=ROUND_HALF_UP)
            member_expenses = item["personal_expenses"] + item["company_expenses"]
            currency_rows.append({
                "member": members[member_id],
                "currency": currency,
                "contributions": money(item["contributions"]),
                "personal_expenses": money(item["personal_expenses"]),
                "company_funded_expenses": money(item["company_expenses"]),
                "net_contribution": money(adjusted_funding),
                "expected_share": money(expected_share),
                "contribution_share": money(
                    item["contributions"] * Decimal("100") / total_contributions[currency]
                    if total_contributions[currency] else ZERO
                ),
                "expense_share": money(
                    member_expenses * Decimal("100") / total_expenses[currency]
                    if total_expenses[currency] else ZERO
                ),
                "net_position": net_position,
            })

        imbalance = sum((row["net_position"] for row in currency_rows), ZERO)
        if imbalance:
            currency_rows[0]["net_position"] -= imbalance
        for row in currency_rows:
            position = row.pop("net_position")
            row.update({
                "amount_receivable": money(max(position, ZERO)),
                "amount_owed": money(max(-position, ZERO)),
                "settlement_amount": money(abs(position)),
                "net_position": money(position),
                "status": "RECEIVABLE" if position > 0 else "OWES" if position < 0 else "SETTLED",
            })
            result.append(row)
    return result


def settlement_recommendations(params=None):
    balances = calculate_member_balances(params)
    recommendations = []
    for currency in Currency.values:
        creditors = [
            [row["member"], Decimal(row["amount_receivable"])]
            for row in balances if row["currency"] == currency and Decimal(row["amount_receivable"]) > 0
        ]
        debtors = [
            [row["member"], Decimal(row["amount_owed"])]
            for row in balances if row["currency"] == currency and Decimal(row["amount_owed"]) > 0
        ]
        creditors.sort(key=lambda item: (-item[1], item[0]["id"]))
        debtors.sort(key=lambda item: (-item[1], item[0]["id"]))
        creditor_index = debtor_index = 0
        while creditor_index < len(creditors) and debtor_index < len(debtors):
            receiver, receivable = creditors[creditor_index]
            payer, owed = debtors[debtor_index]
            amount = min(receivable, owed).quantize(CENT)
            if amount > 0:
                recommendations.append({
                    "id": f"{currency}-{payer['id']}-{receiver['id']}",
                    "payer": payer,
                    "receiver": receiver,
                    "amount": money(amount),
                    "currency": currency,
                    "reason": f"{receiver['full_name']} has funded more than an equal share of recorded member funding.",
                    "status": Settlement.Status.OUTSTANDING,
                })
            creditors[creditor_index][1] -= amount
            debtors[debtor_index][1] -= amount
            if creditors[creditor_index][1] <= 0:
                creditor_index += 1
            if debtors[debtor_index][1] <= 0:
                debtor_index += 1
    return recommendations


def _transaction_user(user):
    return user_summary(user.pk, user.username, user.first_name, user.last_name)


def filtered_transactions(params=None):
    params = params or {}
    requested_type = (params.get("type") or "").upper()
    rows = []
    if requested_type in ("", "EXPENSE"):
        expenses = filter_expenses(
            Expense.objects.select_related("paid_by", "category"), params
        )
        for expense in expenses:
            rows.append({
                "id": f"expense-{expense.pk}",
                "record_id": expense.pk,
                "date": expense.date.isoformat(),
                "created_at": expense.created_at.isoformat(),
                "type": "EXPENSE",
                "member": _transaction_user(expense.paid_by),
                "description": expense.description,
                "category": expense.category.name,
                "category_id": expense.category_id,
                "project": expense.project,
                "product": expense.product,
                "amount": money(expense.amount),
                "currency": expense.currency,
                "status": expense.status,
                "payment_source": expense.payment_source,
                "detail_url": f"/finance/expenses/{expense.pk}",
            })
    if requested_type in ("", "CONTRIBUTION") and not (params.get("category") or params.get("project") or params.get("product") or params.get("payment_source")):
        contributions = filter_contributions(
            Contribution.objects.select_related("member"), params
        )
        for contribution in contributions:
            rows.append({
                "id": f"contribution-{contribution.pk}",
                "record_id": contribution.pk,
                "date": contribution.date.isoformat(),
                "created_at": contribution.created_at.isoformat(),
                "type": "CONTRIBUTION",
                "member": _transaction_user(contribution.member),
                "description": contribution.description,
                "category": "Founder contribution",
                "category_id": None,
                "project": "",
                "product": "",
                "amount": money(contribution.amount),
                "currency": contribution.currency,
                "status": contribution.status,
                "payment_source": "INFLOW",
                "detail_url": "",
            })
    if requested_type in ("", "SETTLEMENT") and not (params.get("category") or params.get("project") or params.get("product") or params.get("payment_source")):
        settlements = filter_settlements(
            Settlement.objects.select_related("payer", "receiver"), params
        )
        for settlement in settlements:
            rows.append({
                "id": f"settlement-{settlement.pk}",
                "record_id": settlement.pk,
                "date": settlement.date.isoformat(),
                "created_at": settlement.created_at.isoformat(),
                "type": "SETTLEMENT",
                "member": _transaction_user(settlement.payer),
                "counterparty": _transaction_user(settlement.receiver),
                "description": settlement.reason or f"{settlement.payer.get_full_name() or settlement.payer.username} paid {settlement.receiver.get_full_name() or settlement.receiver.username}",
                "category": "Member settlement",
                "category_id": None,
                "project": "",
                "product": "",
                "amount": money(settlement.amount),
                "currency": settlement.currency,
                "status": settlement.status,
                "payment_source": "MEMBER_TRANSFER",
                "detail_url": "",
            })
    rows.sort(key=lambda row: (row["date"], row["created_at"], row["id"]), reverse=True)
    return rows


def _monthly_spending(expenses):
    grouped = expenses.annotate(period=TruncMonth("date")).values("period", "currency").annotate(total=Sum("amount"))
    months = defaultdict(lambda: {currency: ZERO for currency in Currency.values})
    for row in grouped:
        months[row["period"].strftime("%Y-%m")][row["currency"]] += row["total"] or ZERO
    return [
        {"month": month, **{currency: money(amount) for currency, amount in totals.items()}}
        for month, totals in sorted(months.items())
    ]


def dashboard_data(filters=None):
    filters = filters or {}
    expenses = filter_expenses(
        Expense.objects.filter(status__in=FINANCIAL_EXPENSE_STATUSES), filters, include_search=False
    )
    contributions = filter_contributions(
        Contribution.objects.filter(status=Contribution.Status.RECORDED), filters, include_search=False
    )
    total_contributions = money_totals(contributions.values("currency").annotate(total=Sum("amount")))
    total_expenses = money_totals(expenses.values("currency").annotate(total=Sum("amount")))
    personal_expenses = money_totals(
        expenses.filter(payment_source=Expense.PaymentSource.PERSONAL).values("currency").annotate(total=Sum("amount"))
    )
    company_expenses = money_totals(
        expenses.filter(payment_source=Expense.PaymentSource.COMPANY).values("currency").annotate(total=Sum("amount"))
    )
    recommendations = settlement_recommendations(filters)
    outstanding = {currency: ZERO for currency in Currency.values}
    for item in recommendations:
        outstanding[item["currency"]] += Decimal(item["amount"])
    net_cash_flow = {
        currency: money(Decimal(total_contributions[currency]) - Decimal(company_expenses[currency]))
        for currency in Currency.values
    }
    category_rows = expenses.values("category_id", "category__name", "category__color", "currency").annotate(total=Sum("amount"))
    categories = defaultdict(lambda: {"totals": {currency: ZERO for currency in Currency.values}})
    for row in category_rows:
        item = categories[row["category_id"]]
        item.update({"id": row["category_id"], "name": row["category__name"], "color": row["category__color"]})
        item["totals"][row["currency"]] += row["total"] or ZERO
    category_spending = []
    for item in categories.values():
        item["totals"] = {currency: money(value) for currency, value in item["totals"].items()}
        category_spending.append(item)
    category_spending.sort(key=lambda item: item["name"].lower())
    return {
        "currencies": list(Currency.values),
        "summary": {
            "total_contributions": total_contributions,
            "total_expenses": total_expenses,
            "personal_expenses": personal_expenses,
            "company_expenses": company_expenses,
            "outstanding_settlements": {currency: money(value) for currency, value in outstanding.items()},
            "net_cash_flow": net_cash_flow,
        },
        "founders": calculate_member_balances(filters),
        "settlements": recommendations,
        "monthly_spending": _monthly_spending(expenses),
        "category_spending": category_spending[:8],
        "recent_transactions": filtered_transactions(filters)[:8],
        "methodology": "Member positions equalize recorded contributions and approved personal-paid expenses among participating members, independently for each currency. Company-funded expenses affect cash flow only.",
    }


def build_reports(params=None):
    params = params or {}
    expenses = filter_expenses(
        Expense.objects.filter(status__in=FINANCIAL_EXPENSE_STATUSES), params, include_search=False
    )
    contributions = filter_contributions(
        Contribution.objects.filter(status=Contribution.Status.RECORDED), params, include_search=False
    )
    annual_rows = expenses.annotate(period=TruncYear("date")).values("period", "currency").annotate(total=Sum("amount"))
    annual = defaultdict(lambda: {currency: ZERO for currency in Currency.values})
    for row in annual_rows:
        annual[str(row["period"].year)][row["currency"]] += row["total"] or ZERO

    group_by = params.get("group_by", "category")
    group_fields = {
        "member": ("paid_by_id", "paid_by__username", "paid_by__first_name", "paid_by__last_name"),
        "category": ("category_id", "category__name"),
        "project": ("project",),
        "product": ("product",),
    }
    selected_fields = group_fields.get(group_by, group_fields["category"])
    grouped_rows = expenses.values(*selected_fields, "currency").annotate(total=Sum("amount")).order_by("-total")
    grouped = []
    for row in grouped_rows:
        if group_by == "member":
            label = f"{row['paid_by__first_name'] or ''} {row['paid_by__last_name'] or ''}".strip() or row["paid_by__username"]
            key = row["paid_by_id"]
        elif group_by == "category":
            label, key = row["category__name"], row["category_id"]
        else:
            label = row[group_by] or f"No {group_by}"
            key = label
        grouped.append({"key": key, "label": label, "currency": row["currency"], "amount": money(row["total"])})

    paid_settlements = filter_settlements(
        Settlement.objects.filter(status__in=(Settlement.Status.PARTIAL, Settlement.Status.PAID)), params, include_search=False
    )
    reimbursement_status = []
    for row in calculate_member_balances(params):
        reimbursement_status.append({
            **row,
            "settlement_status": "OUTSTANDING" if Decimal(row["settlement_amount"]) else "SETTLED",
        })

    return {
        "summary": dashboard_data(params)["summary"],
        "founders": calculate_member_balances(params),
        "monthly_spending": _monthly_spending(expenses),
        "annual_spending": [
            {"year": year, **{currency: money(value) for currency, value in totals.items()}}
            for year, totals in sorted(annual.items())
        ],
        "expense_groups": grouped,
        "contribution_totals": money_totals(contributions.values("currency").annotate(total=Sum("amount"))),
        "cash_flow": {
            "money_in": money_totals(contributions.values("currency").annotate(total=Sum("amount"))),
            "money_out": money_totals(
                expenses.filter(payment_source=Expense.PaymentSource.COMPANY).values("currency").annotate(total=Sum("amount"))
            ),
        },
        "reimbursements": reimbursement_status,
        "recorded_settlements": paid_settlements.count(),
    }


def next_occurrence_date(current, frequency, anchor_day=None):
    if frequency == RecurringExpense.Frequency.WEEKLY:
        return current + timedelta(days=7)
    months = {
        RecurringExpense.Frequency.MONTHLY: 1,
        RecurringExpense.Frequency.QUARTERLY: 3,
        RecurringExpense.Frequency.YEARLY: 12,
    }[frequency]
    total_months = current.year * 12 + current.month - 1 + months
    year, month_index = divmod(total_months, 12)
    month = month_index + 1
    day = min(anchor_day or current.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


@transaction.atomic
def generate_due_expenses(recurring=None, through_date=None, actor=None):
    through_date = through_date or timezone.localdate()
    if isinstance(through_date, str):
        try:
            through_date = date.fromisoformat(through_date)
        except ValueError as exc:
            raise ValidationError({"through_date": "Use a valid ISO date (YYYY-MM-DD)."}) from exc
    rules = RecurringExpense.objects.select_for_update().filter(is_active=True)
    if recurring is not None:
        rules = rules.filter(pk=recurring.pk)
    created = []
    for rule in rules.select_related("category", "paid_by"):
        iterations = 0
        while rule.next_occurrence <= through_date:
            if rule.end_date and rule.next_occurrence > rule.end_date:
                rule.is_active = False
                break
            expense, was_created = Expense.objects.get_or_create(
                recurring_expense=rule,
                occurrence_date=rule.next_occurrence,
                defaults={
                    "paid_by": rule.paid_by,
                    "amount": rule.amount,
                    "currency": rule.currency,
                    "date": rule.next_occurrence,
                    "category": rule.category,
                    "description": rule.name,
                    "vendor": rule.vendor,
                    "project": rule.project,
                    "product": rule.product,
                    "notes": rule.notes,
                    "payment_source": rule.payment_source,
                    "status": Expense.Status.DRAFT,
                    "created_by": actor,
                    "updated_by": actor,
                },
            )
            if was_created:
                ExpenseEvent.objects.create(
                    expense=expense,
                    from_status="",
                    to_status=Expense.Status.DRAFT,
                    actor=actor,
                    note=f"Generated from recurring expense: {rule.name}",
                )
                created.append(expense)
            rule.next_occurrence = next_occurrence_date(
                rule.next_occurrence,
                rule.frequency,
                anchor_day=rule.start_date.day,
            )
            iterations += 1
            if iterations >= 240:
                raise ValidationError("Recurring generation exceeded the safety limit.")
        if rule.end_date and rule.next_occurrence > rule.end_date:
            rule.is_active = False
        rule.save(update_fields=("next_occurrence", "is_active", "updated_at"))
    return created


@transaction.atomic
def record_settlement_payment(settlement, amount, actor):
    locked = Settlement.objects.select_for_update().get(pk=settlement.pk)
    amount = Decimal(amount).quantize(CENT)
    if locked.status in (Settlement.Status.PAID, Settlement.Status.CANCELLED):
        raise ValidationError({"status": "This settlement cannot accept another payment."})
    if amount <= 0 or amount > locked.outstanding_amount:
        raise ValidationError({"amount": "Payment must be positive and no greater than the outstanding amount."})
    locked.settled_amount += amount
    locked.status = Settlement.Status.PAID if locked.settled_amount == locked.amount else Settlement.Status.PARTIAL
    locked.marked_by = actor
    if locked.status == Settlement.Status.PAID:
        locked.paid_at = timezone.now()
    locked.save(update_fields=("settled_amount", "status", "marked_by", "paid_at", "updated_at"))
    return locked


def _csv_safe(value):
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(("=", "+", "-", "@")) else text


def csv_from_transactions(rows):
    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(("Date", "Type", "Member", "Description", "Category", "Project", "Product", "Amount", "Currency", "Status"))
    for row in rows:
        writer.writerow(tuple(_csv_safe(value) for value in (
            row["date"], row["type"], row["member"]["full_name"], row["description"], row["category"],
            row["project"], row["product"], row["amount"], row["currency"], row["status"],
        )))
    return output.getvalue()
