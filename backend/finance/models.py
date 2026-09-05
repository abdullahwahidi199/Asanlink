from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from .validators import validate_finance_file


def finance_upload_path(instance, filename):
    extension = Path(filename).suffix.lower()
    folder = "contributions" if instance.__class__.__name__ == "Contribution" else "receipts"
    return f"finance/{folder}/{instance.date:%Y/%m}/{uuid4().hex}{extension}"


class Currency(models.TextChoices):
    AFN = "AFN", "Afghan afghani"
    USD = "USD", "US dollar"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ExpenseCategory(TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=110, unique=True)
    color = models.CharField(max_length=7, default="#61708a")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        verbose_name_plural = "expense categories"

    def __str__(self):
        return self.name


class RecurringExpense(TimeStampedModel):
    class Frequency(models.TextChoices):
        WEEKLY = "WEEKLY", "Weekly"
        MONTHLY = "MONTHLY", "Monthly"
        QUARTERLY = "QUARTERLY", "Quarterly"
        YEARLY = "YEARLY", "Yearly"

    class PaymentSource(models.TextChoices):
        COMPANY = "COMPANY", "Company funds"
        PERSONAL = "PERSONAL", "Personally paid"

    name = models.CharField(max_length=180)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, choices=Currency.choices)
    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.PROTECT,
        related_name="recurring_expenses",
    )
    vendor = models.CharField(max_length=160, blank=True)
    frequency = models.CharField(max_length=12, choices=Frequency.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    next_occurrence = models.DateField()
    project = models.CharField(max_length=160, blank=True)
    product = models.CharField(max_length=160, blank=True)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recurring_expenses_paid",
    )
    payment_source = models.CharField(
        max_length=10,
        choices=PaymentSource.choices,
        default=PaymentSource.COMPANY,
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="recurring_expenses_created",
    )

    class Meta:
        ordering = ("next_occurrence", "name")
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="finance_recurring_amount_positive",
            ),
        ]
        indexes = [
            models.Index(fields=("is_active", "next_occurrence")),
            models.Index(fields=("currency", "category")),
        ]

    def clean(self):
        super().clean()
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date cannot be before the start date."})
        if self.next_occurrence and self.next_occurrence < self.start_date:
            raise ValidationError({"next_occurrence": "Next occurrence cannot be before the start date."})

    def __str__(self):
        return self.name


class Expense(TimeStampedModel):
    class PaymentSource(models.TextChoices):
        COMPANY = "COMPANY", "Company funds"
        PERSONAL = "PERSONAL", "Personally paid"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        PAID = "PAID", "Paid"
        RECORDED = "RECORDED", "Recorded"

    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="finance_expenses_paid",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, choices=Currency.choices)
    date = models.DateField()
    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.PROTECT,
        related_name="expenses",
    )
    description = models.CharField(max_length=300)
    vendor = models.CharField(max_length=160, blank=True)
    project = models.CharField(max_length=160, blank=True)
    product = models.CharField(max_length=160, blank=True)
    receipt = models.FileField(
        upload_to=finance_upload_path,
        validators=(validate_finance_file,),
        blank=True,
    )
    notes = models.TextField(blank=True)
    payment_source = models.CharField(
        max_length=10,
        choices=PaymentSource.choices,
        default=PaymentSource.COMPANY,
    )
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    recurring_expense = models.ForeignKey(
        RecurringExpense,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_expenses",
    )
    occurrence_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="finance_expenses_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="finance_expenses_updated",
    )

    class Meta:
        ordering = ("-date", "-id")
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="finance_expense_amount_positive",
            ),
            models.UniqueConstraint(
                fields=("recurring_expense", "occurrence_date"),
                condition=Q(recurring_expense__isnull=False, occurrence_date__isnull=False),
                name="finance_expense_recurring_occurrence_unique",
            ),
        ]
        indexes = [
            models.Index(fields=("currency", "date")),
            models.Index(fields=("status", "date")),
            models.Index(fields=("paid_by", "payment_source")),
        ]

    def clean(self):
        super().clean()
        if bool(self.recurring_expense_id) != bool(self.occurrence_date):
            raise ValidationError(
                {"occurrence_date": "A recurring expense and occurrence date must be set together."}
            )

    def __str__(self):
        return f"{self.description} ({self.currency} {self.amount})"


class ExpenseEvent(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="events")
    from_status = models.CharField(max_length=12, choices=Expense.Status.choices, blank=True)
    to_status = models.CharField(max_length=12, choices=Expense.Status.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="finance_expense_events",
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
        indexes = [models.Index(fields=("expense", "created_at"))]

    def __str__(self):
        return f"Expense {self.expense_id}: {self.from_status or 'NEW'} -> {self.to_status}"


class Contribution(TimeStampedModel):
    class Status(models.TextChoices):
        RECORDED = "RECORDED", "Recorded"
        VOIDED = "VOIDED", "Voided"

    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="finance_contributions",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, choices=Currency.choices)
    date = models.DateField()
    description = models.CharField(max_length=300)
    reference = models.CharField(max_length=180, blank=True)
    notes = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to=finance_upload_path,
        validators=(validate_finance_file,),
        blank=True,
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.RECORDED,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="finance_contributions_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="finance_contributions_updated",
    )

    class Meta:
        ordering = ("-date", "-id")
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="finance_contribution_amount_positive",
            ),
        ]
        indexes = [
            models.Index(fields=("member", "currency")),
            models.Index(fields=("status", "date")),
        ]

    def __str__(self):
        return f"{self.member} contributed {self.currency} {self.amount}"


class Settlement(TimeStampedModel):
    class Status(models.TextChoices):
        OUTSTANDING = "OUTSTANDING", "Outstanding"
        PARTIAL = "PARTIAL", "Partially settled"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="finance_settlements_paid",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="finance_settlements_received",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    settled_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, choices=Currency.choices)
    date = models.DateField()
    reason = models.TextField(blank=True)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.OUTSTANDING,
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="finance_settlements_created",
    )
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="finance_settlements_marked",
    )

    class Meta:
        ordering = ("-date", "-id")
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="finance_settlement_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(settled_amount__gte=0) & Q(settled_amount__lte=models.F("amount")),
                name="finance_settlement_paid_amount_valid",
            ),
            models.CheckConstraint(
                condition=~Q(payer=models.F("receiver")),
                name="finance_settlement_distinct_members",
            ),
        ]
        indexes = [
            models.Index(fields=("status", "currency")),
            models.Index(fields=("payer", "receiver")),
        ]

    def clean(self):
        super().clean()
        if self.payer_id and self.payer_id == self.receiver_id:
            raise ValidationError({"receiver": "Payer and receiver must be different members."})
        if self.settled_amount > self.amount:
            raise ValidationError({"settled_amount": "Settled amount cannot exceed the settlement amount."})

    @property
    def outstanding_amount(self):
        return self.amount - self.settled_amount

    def __str__(self):
        return f"{self.payer} -> {self.receiver}: {self.currency} {self.amount}"
