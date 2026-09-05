from django.contrib import admin

from .models import Contribution, Expense, ExpenseCategory, ExpenseEvent, RecurringExpense, Settlement


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")


class ExpenseEventInline(admin.TabularInline):
    model = ExpenseEvent
    extra = 0
    readonly_fields = ("from_status", "to_status", "actor", "note", "created_at")
    can_delete = False


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("description", "amount", "currency", "paid_by", "payment_source", "status", "date")
    list_filter = ("currency", "payment_source", "status", "category")
    search_fields = ("description", "vendor", "project", "product", "paid_by__username")
    readonly_fields = ("created_at", "updated_at")
    inlines = (ExpenseEventInline,)


@admin.register(Contribution)
class ContributionAdmin(admin.ModelAdmin):
    list_display = ("member", "amount", "currency", "status", "date")
    list_filter = ("currency", "status")
    search_fields = ("member__username", "description", "reference")


@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ("payer", "receiver", "amount", "settled_amount", "currency", "status", "date")
    list_filter = ("currency", "status")
    search_fields = ("payer__username", "receiver__username", "reason")


@admin.register(RecurringExpense)
class RecurringExpenseAdmin(admin.ModelAdmin):
    list_display = ("name", "amount", "currency", "frequency", "next_occurrence", "is_active")
    list_filter = ("currency", "frequency", "is_active")
    search_fields = ("name", "vendor", "project", "product")
