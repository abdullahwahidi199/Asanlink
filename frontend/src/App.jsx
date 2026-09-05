import { Navigate, Route, Routes } from 'react-router'

import HomeRedirect from './components/auth/HomeRedirect'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ForbiddenPage from './pages/ForbiddenPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PermissionsPage from './pages/PermissionsPage'
import ProfilePage from './pages/ProfilePage'
import RolesPage from './pages/RolesPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import FinanceLayout from './features/finance/FinanceLayout'
import FinanceOverviewPage from './features/finance/pages/FinanceOverviewPage'
import TransactionsPage from './features/finance/pages/TransactionsPage'
import ExpensesPage from './features/finance/pages/ExpensesPage'
import ExpenseDetailPage from './features/finance/pages/ExpenseDetailPage'
import ContributionsPage from './features/finance/pages/ContributionsPage'
import SettlementsPage from './features/finance/pages/SettlementsPage'
import RecurringExpensesPage from './features/finance/pages/RecurringExpensesPage'
import FinanceReportsPage from './features/finance/pages/FinanceReportsPage'
import PublicWebsite from './features/publicSite/PublicWebsite'
import WebsiteLayout from './features/website/WebsiteLayout'
import {
  BrandingWebsitePage,
  CompanyWebsitePage,
  ContactWebsitePage,
  GeneralWebsitePage,
  IntegrationsWebsitePage,
  LandingContentWebsitePage,
  MediaWebsitePage,
  NavigationWebsitePage,
  ProductsWebsitePage,
  SEOWebsitePage,
} from './features/website/WebsitePages'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicWebsite />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="manage" element={<HomeRedirect />} />
          <Route path="dashboard" element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>} />
          <Route path="finance" element={<ProtectedRoute permission="finance.view"><FinanceLayout /></ProtectedRoute>}>
            <Route index element={<FinanceOverviewPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="expenses/:expenseId" element={<ExpenseDetailPage />} />
            <Route path="contributions" element={<ContributionsPage />} />
            <Route path="settlements" element={<ProtectedRoute permission="finance.settlements.view"><SettlementsPage /></ProtectedRoute>} />
            <Route path="recurring" element={<RecurringExpensesPage />} />
            <Route path="reports" element={<ProtectedRoute permission="finance.reports.view"><FinanceReportsPage /></ProtectedRoute>} />
          </Route>
          <Route path="users" element={<ProtectedRoute permission="users.view"><UsersPage /></ProtectedRoute>} />
          <Route path="roles" element={<ProtectedRoute permission="roles.view"><RolesPage /></ProtectedRoute>} />
          <Route path="permissions" element={<ProtectedRoute permission="permissions.view"><PermissionsPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute permission="settings.view"><SettingsPage /></ProtectedRoute>} />
          <Route path="website" element={<ProtectedRoute permission="website.view"><WebsiteLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<GeneralWebsitePage />} />
            <Route path="company" element={<CompanyWebsitePage />} />
            <Route path="branding" element={<BrandingWebsitePage />} />
            <Route path="navigation" element={<NavigationWebsitePage />} />
            <Route path="landing" element={<LandingContentWebsitePage />} />
            <Route path="products" element={<ProductsWebsitePage />} />
            <Route path="integrations" element={<IntegrationsWebsitePage />} />
            <Route path="contact" element={<ContactWebsitePage />} />
            <Route path="seo" element={<SEOWebsitePage />} />
            <Route path="media" element={<MediaWebsitePage />} />
          </Route>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="forbidden" element={<ForbiddenPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
