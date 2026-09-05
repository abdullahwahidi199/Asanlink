from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ContributionViewSet,
    ExpenseCategoryViewSet,
    ExpenseViewSet,
    FinanceDashboardView,
    FinanceExportView,
    FinanceMembersView,
    FinanceReportsView,
    FinanceTransactionsView,
    RecurringExpenseViewSet,
    SettlementViewSet,
)


router = DefaultRouter()
router.register("categories", ExpenseCategoryViewSet, basename="finance-category")
router.register("expenses", ExpenseViewSet, basename="finance-expense")
router.register("contributions", ContributionViewSet, basename="finance-contribution")
router.register("settlements", SettlementViewSet, basename="finance-settlement")
router.register("recurring-expenses", RecurringExpenseViewSet, basename="finance-recurring")

urlpatterns = [
    path("dashboard/", FinanceDashboardView.as_view(), name="finance-dashboard"),
    path("transactions/", FinanceTransactionsView.as_view(), name="finance-transactions"),
    path("transactions/export/", FinanceExportView.as_view(), name="finance-export"),
    path("reports/", FinanceReportsView.as_view(), name="finance-reports"),
    path("members/", FinanceMembersView.as_view(), name="finance-members"),
    *router.urls,
]
