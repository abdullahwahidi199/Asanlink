import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Badge, Button, Input, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { getApiError } from '../services/errorService'

export default function ProfilePage() {
  const [form, setForm] = useState({ current_password: '', new_password: '', new_password_confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await changePassword(form)
      navigate('/login?password=changed', { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError, 'The password could not be changed.').message)
    } finally { setSaving(false) }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="My account" title="Profile & security" description="Review your central identity and update your password." />
      <div className="profile-grid">
        <section className="panel settings-section"><div><h2>Account</h2><p>Your profile is managed by an authorized user administrator.</p></div><dl className="profile-details"><div><dt>Name</dt><dd>{user.full_name}</dd></div><div><dt>Username</dt><dd>{user.username}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Role</dt><dd><Badge tone="info">{user.role?.name || 'No role'}</Badge></dd></div></dl></section>
        <section className="panel settings-section"><div><h2>Change password</h2><p>Changing it immediately revokes existing JWT sessions.</p></div>{error && <div className="form-alert" role="alert">{error}</div>}<form className="form-stack" onSubmit={submit}><Input label="Current password" type="password" value={form.current_password} onChange={(event) => setForm((current) => ({ ...current, current_password: event.target.value }))} autoComplete="current-password" required /><Input label="New password" type="password" value={form.new_password} onChange={(event) => setForm((current) => ({ ...current, new_password: event.target.value }))} autoComplete="new-password" required /><Input label="Confirm new password" type="password" value={form.new_password_confirm} onChange={(event) => setForm((current) => ({ ...current, new_password_confirm: event.target.value }))} autoComplete="new-password" required /><Button type="submit" loading={saving}>Change password</Button></form></section>
      </div>
    </div>
  )
}

