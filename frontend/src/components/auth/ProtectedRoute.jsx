import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function ProtectedRoute({ permission, children }) {
  const location = useLocation()
  const { isAuthenticated, isLoading, hasPermission } = useAuth()

  if (isLoading) {
    return (
      <div className="route-loading">
        <LoadingSpinner label="Restoring your session" size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/forbidden" replace state={{ from: location }} />
  }

  return children || <Outlet />
}

