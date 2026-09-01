import { Navigate } from 'react-router'

import { visibleNavigation } from '../../config/navigation'
import { useAuth } from '../../context/AuthContext'

export default function HomeRedirect() {
  const { hasPermission } = useAuth()
  const first = visibleNavigation(hasPermission)[0]
  return <Navigate to={first?.path || '/forbidden'} replace />
}

