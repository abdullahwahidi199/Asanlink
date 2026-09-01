import { Badge, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()
  const grouped = user.permissions.reduce((groups, codename) => {
    const module = codename.split('.').slice(0, -1).join('.')
    groups[module] = (groups[module] || 0) + 1
    return groups
  }, {})

  return (
    <div className="page">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${user.first_name || user.username}`}
        description="Your workspace reflects the access assigned by your Asanlink role."
      />
      <div className="metrics-grid">
        <article className="metric-card"><span>Current role</span><strong>{user.role?.name || 'No role'}</strong><Badge tone={user.is_admin ? 'info' : 'neutral'}>{user.is_admin ? 'Administrator' : 'Assigned role'}</Badge></article>
        <article className="metric-card"><span>Effective permissions</span><strong>{user.permissions.length}</strong><small>Active capabilities from the backend</small></article>
        <article className="metric-card"><span>Account status</span><strong>Active</strong><Badge tone="success">Secure session</Badge></article>
      </div>
      <section className="panel">
        <div className="panel__header"><div><h2>Your access</h2><p>Permissions are grouped by module and enforced by the API.</p></div></div>
        <div className="module-grid">
          {Object.entries(grouped).map(([module, count]) => (
            <div className="module-card" key={module}><strong>{module.replaceAll('.', ' / ')}</strong><span>{count} permission{count === 1 ? '' : 's'}</span></div>
          ))}
          {!Object.keys(grouped).length && <p className="muted">No module permissions are currently assigned.</p>}
        </div>
      </section>
    </div>
  )
}

