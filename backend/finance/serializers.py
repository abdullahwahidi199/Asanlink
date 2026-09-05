from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Contribution, Expense, ExpenseCategory, ExpenseEvent, RecurringExpense, Settlement


User = get_user_model()


class FinanceMemberSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "full_name", "is_active")
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ("id", "name", "slug", "color", "is_active")
        read_only_fields = fields


class ExpenseEventSerializer(serializers.ModelSerializer):
    actor = FinanceMemberSerializer(read_only=True)
    from_status_display = serializers.CharField(source="get_from_status_display", read_only=True)
    to_status_display = serializers.CharField(source="get_to_status_display", read_only=True)

    class Meta:
        model = ExpenseEvent
        fields = (
            "id", "from_status", "from_status_display", "to_status", "to_status_display",
            "actor", "note", "created_at",
        )
        read_only_fields = fields


class PositiveAmountMixin:
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class ExpenseSerializer(PositiveAmountMixin, serializers.ModelSerializer):
    paid_by = FinanceMemberSerializer(read_only=True)
    paid_by_id = serializers.PrimaryKeyRelatedField(
        source="paid_by",
        queryset=User.objects.filter(is_active=True),
        write_only=True,
    )
    category = ExpenseCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=ExpenseCategory.objects.filter(is_active=True),
        write_only=True,
    )
    created_by = FinanceMemberSerializer(read_only=True)
    updated_by = FinanceMemberSerializer(read_only=True)
    events = ExpenseEventSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_source_display = serializers.CharField(source="get_payment_source_display", read_only=True)
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = (
            "id", "paid_by", "paid_by_id", "amount", "currency", "date", "category",
            "category_id", "description", "vendor", "project", "product", "receipt",
            "notes", "payment_source", "payment_source_display", "status", "status_display",
            "recurring_expense", "occurrence_date", "created_by", "updated_by", "events",
            "allowed_actions", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "status", "recurring_expense", "occurrence_date", "created_by", "updated_by",
            "events", "created_at", "updated_at",
        )

    def get_allowed_actions(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return []
        actions = []
        if obj.status in (Expense.Status.DRAFT, Expense.Status.REJECTED):
            if user.has_system_permission("finance.expenses.edit"):
                actions.append("edit")
            if user.has_system_permission("finance.expenses.submit"):
                actions.append("submit")
        if obj.status == Expense.Status.SUBMITTED:
            if user.has_system_permission("finance.expenses.approve"):
                actions.append("approve")
            if user.has_system_permission("finance.expenses.reject"):
                actions.append("reject")
        if obj.status == Expense.Status.APPROVED and user.has_system_permission("finance.expenses.record"):
            actions.append("record-payment")
        return actions

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.status not in (Expense.Status.DRAFT, Expense.Status.REJECTED):
            raise serializers.ValidationError("Only draft or rejected expenses can be edited.")
        return attrs


class ContributionSerializer(PositiveAmountMixin, serializers.ModelSerializer):
    member = FinanceMemberSerializer(read_only=True)
    member_id = serializers.PrimaryKeyRelatedField(
        source="member",
        queryset=User.objects.filter(is_active=True),
        write_only=True,
    )
    created_by = FinanceMemberSerializer(read_only=True)
    updated_by = FinanceMemberSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Contribution
        fields = (
            "id", "member", "member_id", "amount", "currency", "date", "description",
            "reference", "notes", "attachment", "status", "status_display", "created_by",
            "updated_by", "created_at", "updated_at",
        )
        read_only_fields = ("id", "status", "created_by", "updated_by", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.status == Contribution.Status.VOIDED:
            raise serializers.ValidationError("Voided contributions cannot be edited.")
        return attrs


class SettlementSerializer(PositiveAmountMixin, serializers.ModelSerializer):
    payer = FinanceMemberSerializer(read_only=True)
    payer_id = serializers.PrimaryKeyRelatedField(
        source="payer", queryset=User.objects.filter(is_active=True), write_only=True
    )
    receiver = FinanceMemberSerializer(read_only=True)
    receiver_id = serializers.PrimaryKeyRelatedField(
        source="receiver", queryset=User.objects.filter(is_active=True), write_only=True
    )
    created_by = FinanceMemberSerializer(read_only=True)
    marked_by = FinanceMemberSerializer(read_only=True)
    outstanding_amount = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Settlement
        fields = (
            "id", "payer", "payer_id", "receiver", "receiver_id", "amount", "settled_amount",
            "outstanding_amount", "currency", "date", "reason", "status", "status_display",
            "paid_at", "created_by", "marked_by", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "settled_amount", "status", "paid_at", "created_by", "marked_by",
            "created_at", "updated_at",
        )

    def get_outstanding_amount(self, obj):
        return f"{obj.outstanding_amount:.2f}"

    def validate(self, attrs):
        attrs = super().validate(attrs)
        payer = attrs.get("payer", getattr(self.instance, "payer", None))
        receiver = attrs.get("receiver", getattr(self.instance, "receiver", None))
        if payer and receiver and payer.pk == receiver.pk:
            raise serializers.ValidationError({"receiver_id": "Payer and receiver must be different."})
        return attrs


class SettlementPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"))


class ExpenseTransitionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class RecurringExpenseSerializer(PositiveAmountMixin, serializers.ModelSerializer):
    paid_by = FinanceMemberSerializer(read_only=True)
    paid_by_id = serializers.PrimaryKeyRelatedField(
        source="paid_by", queryset=User.objects.filter(is_active=True), write_only=True
    )
    category = ExpenseCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category", queryset=ExpenseCategory.objects.filter(is_active=True), write_only=True
    )
    created_by = FinanceMemberSerializer(read_only=True)
    frequency_display = serializers.CharField(source="get_frequency_display", read_only=True)
    payment_source_display = serializers.CharField(source="get_payment_source_display", read_only=True)

    class Meta:
        model = RecurringExpense
        fields = (
            "id", "name", "amount", "currency", "category", "category_id", "vendor",
            "frequency", "frequency_display", "start_date", "end_date", "next_occurrence",
            "project", "product", "paid_by", "paid_by_id", "payment_source",
            "payment_source_display", "notes", "is_active", "created_by", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")
        extra_kwargs = {"next_occurrence": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        next_occurrence = attrs.get("next_occurrence", getattr(self.instance, "next_occurrence", None)) or start
        if end and start and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before the start date."})
        if start and next_occurrence < start:
            raise serializers.ValidationError({"next_occurrence": "Next occurrence cannot be before the start date."})
        attrs["next_occurrence"] = next_occurrence
        return attrs
