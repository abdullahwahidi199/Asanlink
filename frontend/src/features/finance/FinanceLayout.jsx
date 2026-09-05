import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { BarChart3, CalendarClock, HandCoins, Landmark, ListChecks, ReceiptText, Scale } from 'lucide-react'

import PermissionGate from '../../components/auth/PermissionGate'

const links = [
  { to: '/finance', end: true, label: 'Overview', icon: Landmark },
  { to: '/finance/transactions', label: 'Transactions', icon: ListChecks },
  { to: '/finance/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/finance/contributions', label: 'Contributions', icon: HandCoins },
  { to: '/finance/settlements', label: 'Settlements', icon: Scale, permission: 'finance.settlements.view' },
  { to: '/finance/recurring', label: 'Recurring', icon: CalendarClock },
  { to: '/finance/reports', label: 'Reports', icon: BarChart3, permission: 'finance.reports.view' },
]

export default function FinanceLayout() {
  const tabsRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    tabsRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [location.pathname])

  return (
    <div className="finance-workspace">
      <nav ref={tabsRef} className="finance-tabs" aria-label="Finance sections">
        {links.map(({ to, end, label, icon: LinkIcon, permission }) => (
          <PermissionGate key={to} permission={permission}>
            <NavLink to={to} end={end} className={({ isActive }) => `finance-tab ${isActive ? 'finance-tab--active' : ''}`}>
              <LinkIcon size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </PermissionGate>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
