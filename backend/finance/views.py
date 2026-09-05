from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from accounts.authorization import HasSystemPermission, require_permission

from .models import Contribution, Expense, ExpenseCategory, ExpenseEvent, RecurringExpense, Settlement
from .pdf import render_transactions_pdf
from .serializers import (
    ContributionSerializer,
    ExpenseCategorySerializer,
    ExpenseSerializer,
    ExpenseTransitionSerializer,
    FinanceMemberSerializer,
    RecurringExpenseSerializer,
    SettlementPaymentSerializer,
    SettlementSerializer,
)
from .services import (
    build_reports,
    csv_from_transactions,
    dashboard_data,
    filter_contributions,
    filter_expenses,
    filter_settlements,
    filtered_transactions,
    generate_due_expenses,
    record_settlement_payment,
    settlement_recommendations,
    transition_expense,
)


User = get_user_model()


class ExpenseCategoryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = ExpenseCategory.objects.filter(is_active=True)
    serializer_class = ExpenseCategorySerializer
    permission_classes = (IsAuthenticated, HasSystemPermission)
    permission_map = {"list": "finance.view", "retrieve": "finance.view"}
    pagination_class = None


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related(
        "paid_by", "category", "created_by", "updated_by", "recurring_expense"
    ).prefetch_related("events__actor")
    serializer_class = ExpenseSerializer
    permission_classes = (IsAuthenticated, HasSystemPermission)
    http_method_names = ("get", "post", "patch", "head", "options")
    permission_map = {
        "list": "finance.view",
        "retrieve": "finance.view",
        "create": "finance.expenses.create",
        "partial_update": "finance.expenses.edit",
        "submit": "finance.expenses.submit",
        "approve": "finance.expenses.approve",
        "reject": "finance.expenses.reject",
        "record_payment": "finance.expenses.record",
    }
    search_fields = ("description", "vendor", "project", "product", "notes", "paid_by__username")
    ordering_fields = ("date", "amount", "created_at", "updated_at", "status")
    ordering = ("-date", "-id")

    def get_queryset(self):
        return filter_expenses(super().get_queryset(), self.request.query_params)

    @transaction.atomic
    def perform_create(self, serializer):
        expense = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        ExpenseEvent.objects.create(
            expense=expense,
            from_status="",
            to_status=Expense.Status.DRAFT,
            actor=self.request.user,
            note="Expense created",
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def _transition(self, request, target_status):
        expense = self.get_object()
        payload = ExpenseTransitionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        expense = transition_expense(
            expense,
            target_status,
            request.user,
            payload.validated_data.get("note", ""),
        )
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return self._transition(request, Expense.Status.SUBMITTED)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return self._transition(request, Expense.Status.APPROVED)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return self._transition(request, Expense.Status.REJECTED)

    @action(detail=True, methods=("post",), url_path="record-payment")
    def record_payment(self, request, pk=None):
        expense = self.get_object()
        target = (
            Expense.Status.RECORDED
            if expense.payment_source == Expense.PaymentSource.PERSONAL
            else Expense.Status.PAID
        )
        return self._transition(request, target)


class ContributionViewSet(viewsets.ModelViewSet):
    queryset = Contribution.objects.select_related("member", "created_by", "updated_by")
    serializer_class = ContributionSerializer
    permission_classes = (IsAuthenticated, HasSystemPermission)
    http_method_names = ("get", "post", "patch", "head", "options")
    permission_map = {
        "list": "finance.view",
        "retrieve": "finance.view",
        "create": "finance.contributions.create",
        "partial_update": "finance.contributions.edit",
        "void": "finance.contributions.edit",
    }
    search_fields = ("description", "reference", "notes", "member__username")
    ordering_fields = ("date", "amount", "created_at", "updated_at")
    ordering = ("-date", "-id")

    def get_queryset(self):
        return filter_contributions(super().get_queryset(), self.request.query_params)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=("post",))
    def void(self, request, pk=None):
        contribution = self.get_object()
        if contribution.status == Contribution.Status.VOIDED:
            return Response(self.get_serializer(contribution).data)
        contribution.status = Contribution.Status.VOIDED
        contribution.updated_by = request.user
        contribution.save(update_fields=("status", "updated_by", "updated_at"))
        return Response(self.get_serializer(contribution).data)


class SettlementViewSet(viewsets.ModelViewSet):
    queryset = Settlement.objects.select_related("payer", "receiver", "created_by", "marked_by")
    serializer_class = SettlementSerializer
    permission_classes = (IsAuthenticated, HasSystemPermission)
    http_method_names = ("get", "post", "head", "options")
    permission_map = {
        "list": "finance.settlements.view",
        "retrieve": "finance.settlements.view",
        "create": "finance.settlements.settle",
        "recommendations": "finance.settlements.view",
        "record": "finance.settlements.settle",
        "mark_paid": "finance.settlements.settle",
    }
    ordering = ("-date", "-id")

    def get_queryset(self):
        return filter_settlements(super().get_queryset(), self.request.query_params)

    def _validate_recommendation(self, validated_data):
        payer = validated_data["payer"]
        receiver = validated_data["receiver"]
        currency = validated_data["currency"]
        amount = validated_data["amount"]
        match = next((item for item in settlement_recommendations() if (
            item["payer"]["id"] == payer.pk
            and item["receiver"]["id"] == receiver.pk
            and item["currency"] == currency
        )), None)
        reserved = sum((
            item.outstanding_amount for item in Settlement.objects.filter(
                payer=payer,
                receiver=receiver,
                currency=currency,
                status__in=(Settlement.Status.OUTSTANDING, Settlement.Status.PARTIAL),
            )
        ), 0)
        available = (Decimal(match["amount"]) if match else Decimal("0")) - reserved
        if amount > available:
            raise ValidationError({
                "amount": f"The current recommended amount available for this route is {max(available, Decimal('0')):.2f} {currency}."
            })

    def perform_create(self, serializer):
        self._validate_recommendation(serializer.validated_data)
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=("get",))
    def recommendations(self, request):
        return Response(settlement_recommendations(request.query_params))

    @action(detail=False, methods=("post",))
    @transaction.atomic
    def record(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self._validate_recommendation(serializer.validated_data)
        amount = serializer.validated_data["amount"]
        settlement = serializer.save(
            created_by=request.user,
            marked_by=request.user,
            settled_amount=amount,
            status=Settlement.Status.PAID,
            paid_at=timezone.now(),
        )
        return Response(self.get_serializer(settlement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        settlement = self.get_object()
        serializer = SettlementPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        settlement = record_settlement_payment(
            settlement, serializer.validated_data["amount"], request.user
        )
        return Response(self.get_serializer(settlement).data)


class RecurringExpenseViewSet(viewsets.ModelViewSet):
    queryset = RecurringExpense.objects.select_related("category", "paid_by", "created_by")
    serializer_class = RecurringExpenseSerializer
    permission_classes = (IsAuthenticated, HasSystemPermission)
    permission_map = {
        "list": "finance.view",
        "retrieve": "finance.view",
        "create": "finance.recurring.manage",
        "update": "finance.recurring.manage",
        "partial_update": "finance.recurring.manage",
        "destroy": "finance.recurring.manage",
        "pause": "finance.recurring.manage",
        "resume": "finance.recurring.manage",
        "generate": "finance.recurring.manage",
        "generate_due": "finance.recurring.manage",
    }
    search_fields = ("name", "vendor", "project", "product", "notes")
    ordering_fields = ("name", "amount", "next_occurrence", "created_at", "is_active")
    ordering = ("next_occurrence", "name")

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        if params.get("currency"):
            queryset = queryset.filter(currency=params["currency"])
        if params.get("category"):
            queryset = queryset.filter(category_id=params["category"])
        if params.get("active") in ("true", "false"):
            queryset = queryset.filter(is_active=params["active"] == "true")
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=("post",))
    def pause(self, request, pk=None):
        recurring = self.get_object()
        recurring.is_active = False
        recurring.save(update_fields=("is_active", "updated_at"))
        return Response(self.get_serializer(recurring).data)

    @action(detail=True, methods=("post",))
    def resume(self, request, pk=None):
        recurring = self.get_object()
        if recurring.end_date and recurring.next_occurrence > recurring.end_date:
            return Response(
                {"error": {"message": "This schedule has passed its end date.", "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        recurring.is_active = True
        recurring.save(update_fields=("is_active", "updated_at"))
        return Response(self.get_serializer(recurring).data)

    @action(detail=True, methods=("post",))
    def generate(self, request, pk=None):
        recurring = self.get_object()
        through_date = request.data.get("through_date") or None
        created = generate_due_expenses(recurring, through_date, request.user)
        return Response({"created": len(created), "expense_ids": [expense.pk for expense in created]})

    @action(detail=False, methods=("post",), url_path="generate-due")
    def generate_due(self, request):
        through_date = request.data.get("through_date") or None
        created = generate_due_expenses(None, through_date, request.user)
        return Response({"created": len(created), "expense_ids": [expense.pk for expense in created]})


class FinanceDashboardView(APIView):
    permission_classes = (IsAuthenticated, require_permission("finance.view"))

    def get(self, request):
        return Response(dashboard_data(request.query_params))


class FinanceTransactionsView(APIView):
    permission_classes = (IsAuthenticated, require_permission("finance.view"))

    def get(self, request):
        rows = filtered_transactions(request.query_params)
        try:
            page = max(int(request.query_params.get("page", 1)), 1)
            page_size = min(max(int(request.query_params.get("page_size", 25)), 1), 250)
        except ValueError:
            page, page_size = 1, 25
        start = (page - 1) * page_size
        return Response({
            "count": len(rows),
            "page": page,
            "page_size": page_size,
            "results": rows[start:start + page_size],
        })


class FinanceReportsView(APIView):
    permission_classes = (IsAuthenticated, require_permission("finance.reports.view"))

    def get(self, request):
        return Response(build_reports(request.query_params))


class FinanceExportView(APIView):
    permission_classes = (IsAuthenticated, require_permission("finance.reports.export"))

    def get(self, request):
        rows = filtered_transactions(request.query_params)
        export_format = request.query_params.get("export_format", "csv").lower()
        generated = timezone.localtime().strftime("%Y-%m-%d %H:%M %Z")
        active_filters = ", ".join(
            f"{key}={value}" for key, value in request.query_params.items()
            if key not in ("export_format", "page", "page_size") and value
        ) or "None"
        filename_date = timezone.localdate().isoformat()
        if export_format == "csv":
            response = HttpResponse(
                "\ufeff" + csv_from_transactions(rows),
                content_type="text/csv; charset=utf-8",
            )
            response["Content-Disposition"] = f'attachment; filename="finance-transactions-{filename_date}.csv"'
            return response
        if export_format == "pdf":
            content = render_transactions_pdf(rows, {
                "company": settings.COMPANY_NAME,
                "title": "Company Finance Transaction Report",
                "generated": generated,
                "filters": active_filters,
            })
            response = HttpResponse(content, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="finance-report-{filename_date}.pdf"'
            return response
        return Response(
            {"error": {"message": "Format must be csv or pdf.", "details": {"format": ["Unsupported format."]}}},
            status=status.HTTP_400_BAD_REQUEST,
        )


class FinanceMembersView(APIView):
    permission_classes = (IsAuthenticated, require_permission("finance.view"))

    def get(self, request):
        members = User.objects.filter(is_active=True).order_by("first_name", "last_name", "username")
        return Response(FinanceMemberSerializer(members, many=True).data)
