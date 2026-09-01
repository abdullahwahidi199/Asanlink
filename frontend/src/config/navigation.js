export const navigationItems = [
  { label: 'Dashboard', path: '/dashboard', permission: 'dashboard.view', icon: 'dashboard' },
  { label: 'Users', path: '/users', permission: 'users.view', icon: 'users' },
  { label: 'Roles', path: '/roles', permission: 'roles.view', icon: 'shield' },
  {
    label: 'Permissions',
    path: '/permissions',
    permission: 'permissions.view',
    icon: 'key',
  },
  { label: 'Settings', path: '/settings', permission: 'settings.view', icon: 'settings' },
]

export const visibleNavigation = (hasPermission) =>
  navigationItems.filter((item) => !item.permission || hasPermission(item.permission))

