import { useAuth } from '../../context/AuthContext'

export default function PermissionGate({ permission, children, fallback = null }) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? children : fallback
}

