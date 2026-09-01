import { Route, Routes } from 'react-router'

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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute permission="users.view"><UsersPage /></ProtectedRoute>} />
          <Route path="roles" element={<ProtectedRoute permission="roles.view"><RolesPage /></ProtectedRoute>} />
          <Route path="permissions" element={<ProtectedRoute permission="permissions.view"><PermissionsPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute permission="settings.view"><SettingsPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="forbidden" element={<ForbiddenPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
