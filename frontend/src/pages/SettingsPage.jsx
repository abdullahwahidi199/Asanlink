import PermissionGate from '../components/auth/PermissionGate'
import ThemeToggle from '../components/ThemeToggle'
import { Badge, PageHeader } from '../components/ui'
import { useTheme } from '../context/ThemeContext'

export default function SettingsPage() {
  const { theme } = useTheme()
  return (
    <div className="page">
      <PageHeader eyebrow="Workspace" title="Settings" description="Shared Asanlink platform preferences and environment information." />
      <section className="panel settings-section">
        <div><h2>Appearance</h2><p>The Asanlink blue identity is optimized for both available color modes.</p></div>
        <div className="settings-row"><div><strong>Color theme</strong><span>Currently using {theme} mode</span></div><PermissionGate permission="settings.update" fallback={<Badge tone="neutral">View only</Badge>}><ThemeToggle showLabel /></PermissionGate></div>
      </section>
      <section className="panel settings-section">
        <div><h2>Authorization source</h2><p>Roles and permissions are loaded from the central Django API.</p></div>
        <div className="settings-row"><div><strong>Security boundary</strong><span>Backend-enforced database permissions</span></div><Badge tone="success">Enabled</Badge></div>
        <div className="settings-row"><div><strong>Session type</strong><span>JWT access token with rotating refresh token</span></div><Badge tone="info">Configured</Badge></div>
      </section>
    </div>
  )
}

