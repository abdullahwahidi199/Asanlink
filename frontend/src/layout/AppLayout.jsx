import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import Icon from '../components/Icon'
import ThemeToggle from '../components/ThemeToggle'
import Dropdown from '../components/ui/Dropdown'
import { navigationItems, visibleNavigation } from '../config/navigation'
import { useAuth } from '../context/AuthContext'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, hasPermission, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const items = useMemo(() => visibleNavigation(hasPermission), [hasPermission])
  const activeItem = navigationItems.find((item) => location.pathname.startsWith(item.path))

  useEffect(() => setMobileOpen(false), [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}` || user?.username?.[0] || 'A'

  return (
    <div className="app-shell">
      {mobileOpen && <button className="sidebar-overlay" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">A</div>
          <div><strong>Asanlink</strong><span>Central System</span></div>
        </div>
        <nav className="sidebar__nav" aria-label="Primary navigation">
          {items.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {!items.length && <p className="sidebar__empty">No modules are assigned to your role.</p>}
        </nav>
        <div className="sidebar__footer"><span>Asanlink Platform</span><small>Phase 1 foundation</small></div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__leading">
            <button className="icon-button mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Icon name="menu" />
            </button>
            <div><span className="topbar__context">Workspace</span><strong>{activeItem?.label || 'Asanlink Central'}</strong></div>
          </div>
          <div className="topbar__actions">
            <ThemeToggle />
            <Dropdown
              label={
                <span className="user-chip">
                  <span className="avatar">{initials.toUpperCase()}</span>
                  <span className="user-chip__text"><strong>{user?.full_name || user?.username}</strong><small>{user?.role?.name || 'No role'}</small></span>
                </span>
              }
            >
              <div className="dropdown__identity"><strong>{user?.full_name || user?.username}</strong><span>{user?.email}</span></div>
              <button type="button" onClick={() => navigate('/profile')}>Profile &amp; security</button>
              <button type="button" onClick={handleLogout}>Sign out</button>
            </Dropdown>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}
