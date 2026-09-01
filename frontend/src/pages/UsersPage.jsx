import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'

import PermissionGate from '../components/auth/PermissionGate'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Table,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fieldError, getApiError } from '../services/errorService'
import roleService from '../services/roleService'
import userService from '../services/userService'

const PAGE_SIZE = 10
const blankUser = {
  username: '', email: '', first_name: '', last_name: '', phone: '', role_id: '',
  is_active: true, password: '', password_confirm: '',
}

const displayDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Never'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [resetUser, setResetUser] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const { hasPermission, user: currentUser } = useAuth()
  const { addToast } = useToast()

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await userService.list({ page, page_size: PAGE_SIZE, search, ordering: '-date_joined' })
      setUsers(data.results || data)
      setCount(data.count ?? data.length)
    } catch (requestError) {
      setError(getApiError(requestError).message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  const loadRoles = useCallback(async () => {
    if (!hasPermission('roles.view')) return
    try {
      const data = await roleService.list({ page_size: 250, ordering: 'name' })
      setRoles((data.results || data).filter((role) => role.is_active))
    } catch {
      setRoles([])
    }
  }, [hasPermission])

  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => { loadRoles() }, [loadRoles])

  const submitUser = async (payload) => {
    if (editor === 'create') await userService.create(payload)
    else await userService.update(editor.id, payload)
    addToast({ type: 'success', title: editor === 'create' ? 'User created' : 'User updated', message: `${payload.username}'s account was saved.` })
    setEditor(null)
    await loadUsers()
  }

  const runConfirmedAction = async () => {
    if (!confirmation) return
    setActionLoading(true)
    try {
      const { type, user } = confirmation
      if (type === 'delete') await userService.remove(user.id)
      if (type === 'activate') await userService.activate(user.id)
      if (type === 'deactivate') await userService.deactivate(user.id)
      addToast({ type: 'success', title: 'Account updated', message: `${user.username} was ${type === 'delete' ? 'deleted' : `${type}d`}.` })
      setConfirmation(null)
      await loadUsers()
    } catch (requestError) {
      addToast({ type: 'error', title: 'Action failed', message: getApiError(requestError).message })
    } finally {
      setActionLoading(false)
    }
  }

  const columns = useMemo(() => {
    const base = [
      { key: 'user', label: 'User', render: (item) => <div className="identity-cell"><span className="avatar avatar--table">{(item.first_name?.[0] || item.username[0]).toUpperCase()}</span><div><strong>{item.full_name}</strong><span>@{item.username}</span></div></div> },
      { key: 'email', label: 'Contact', render: (item) => <div className="primary-cell"><span>{item.email}</span><small>{item.phone || 'No phone'}</small></div> },
      { key: 'role', label: 'Role', render: (item) => item.role ? <Badge tone={item.role.name === 'ADMIN' ? 'info' : 'neutral'}>{item.role.name}</Badge> : <span className="muted">No role</span> },
      { key: 'is_active', label: 'Status', render: (item) => <Badge tone={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge> },
      { key: 'last_login', label: 'Last login', render: (item) => displayDate(item.last_login) },
    ]
    if (hasPermission('users.update') || hasPermission('users.delete')) {
      base.push({ key: 'actions', label: 'Actions', className: 'table-actions', render: (item) => (
        <div className="action-group">
          <PermissionGate permission="users.update">
            <Button className="table-action-button" size="small" variant="ghost" onClick={() => setEditor(item)} aria-label={`Edit ${item.full_name}`} title="Edit user">
              <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />
            </Button>
            <Button className="table-action-button" size="small" variant="ghost" onClick={() => setResetUser(item)} aria-label={`Reset ${item.full_name}'s password`} title="Reset password">
              <KeyRound size={16} strokeWidth={1.8} aria-hidden="true" />
            </Button>
            <Button
              className="table-action-button"
              size="small"
              variant="ghost"
              disabled={item.id === currentUser.id}
              onClick={() => setConfirmation({ type: item.is_active ? 'deactivate' : 'activate', user: item })}
              aria-label={`${item.is_active ? 'Deactivate' : 'Activate'} ${item.full_name}`}
              title={`${item.is_active ? 'Deactivate' : 'Activate'} user`}
            >
              {item.is_active
                ? <PowerOff size={16} strokeWidth={1.8} aria-hidden="true" />
                : <Power size={16} strokeWidth={1.8} aria-hidden="true" />}
            </Button>
          </PermissionGate>
          <PermissionGate permission="users.delete">
            <Button className="table-action-button" size="small" variant="danger-ghost" disabled={item.id === currentUser.id} onClick={() => setConfirmation({ type: 'delete', user: item })} aria-label={`Delete ${item.full_name}`} title="Delete user">
              <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </PermissionGate>
        </div>
      ) })
    }
    return base
  }, [hasPermission, currentUser.id])

  const empty = <EmptyState title="No users found" message={search ? 'Try a different search term.' : 'Create the first managed user account.'} action={!search && hasPermission('users.create') ? <Button onClick={() => setEditor('create')}>Create user</Button> : null} />

  return (
    <div className="page">
      <PageHeader eyebrow="Access management" title="Users" description="Create accounts, assign roles, and control active access." actions={<PermissionGate permission="users.create"><Button onClick={() => setEditor('create')}>Create user</Button></PermissionGate>} />
      <section className="panel">
        <div className="panel__toolbar"><SearchInput value={search} onSearch={(value) => { setPage(1); setSearch(value) }} placeholder="Search name, email, username, or phone" /><span className="result-count">{count} user{count === 1 ? '' : 's'}</span></div>
        {loading ? <div className="panel__state"><LoadingSpinner label="Loading users" /></div> : error ? <ErrorState message={error} onRetry={loadUsers} /> : <><Table columns={columns} data={users} empty={empty} /><Pagination page={page} total={count} pageSize={PAGE_SIZE} onChange={setPage} /></>}
      </section>

      <UserEditor open={Boolean(editor)} user={editor === 'create' ? null : editor} roles={roles} onClose={() => setEditor(null)} onSubmit={submitUser} />
      <PasswordResetModal user={resetUser} onClose={() => setResetUser(null)} onSaved={() => { setResetUser(null); addToast({ type: 'success', title: 'Password reset', message: 'The new password is active and existing refresh tokens were revoked.' }) }} />
      <ConfirmDialog
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        onConfirm={runConfirmedAction}
        loading={actionLoading}
        danger={confirmation?.type === 'delete' || confirmation?.type === 'deactivate'}
        title={`${confirmation?.type === 'delete' ? 'Delete' : confirmation?.type === 'deactivate' ? 'Deactivate' : 'Activate'} user`}
        message={confirmation ? `${confirmation.type === 'delete' ? 'Permanently delete' : `${confirmation.type[0].toUpperCase()}${confirmation.type.slice(1)}`} ${confirmation.user.username}?${confirmation.type === 'delete' ? ' This cannot be undone.' : ''}` : ''}
        confirmLabel={confirmation?.type === 'delete' ? 'Delete user' : 'Confirm'}
      />
    </div>
  )
}

function UserEditor({ open, user, roles, onClose, onSubmit }) {
  const [form, setForm] = useState(blankUser)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(user)

  useEffect(() => {
    setForm(user ? { username: user.username, email: user.email, first_name: user.first_name || '', last_name: user.last_name || '', phone: user.phone || '', role_id: user.role?.id || '', is_active: user.is_active, password: '', password_confirm: '' } : blankUser)
    setErrors({}); setMessage('')
  }, [user, open])

  const update = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(''); setErrors({})
    const payload = { ...form, role_id: form.role_id ? Number(form.role_id) : null }
    if (isEdit) { delete payload.password; delete payload.password_confirm }
    try { await onSubmit(payload) } catch (requestError) {
      const parsed = getApiError(requestError, 'The user could not be saved.')
      setMessage(parsed.message); setErrors(parsed.fields)
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit user' : 'Create user'} description="Profile details and access are validated by the central API." size="large" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="user-form" loading={saving}>{isEdit ? 'Save changes' : 'Create user'}</Button></>}>
      {message && <div className="form-alert" role="alert">{message}</div>}
      <form id="user-form" className="form-grid" onSubmit={submit}>
        <Input label="Username" name="username" value={form.username} onChange={update} error={fieldError(errors, 'username')} required autoComplete="off" />
        <Input label="Email" name="email" type="email" value={form.email} onChange={update} error={fieldError(errors, 'email')} required autoComplete="off" />
        <Input label="First name" name="first_name" value={form.first_name} onChange={update} error={fieldError(errors, 'first_name')} />
        <Input label="Last name" name="last_name" value={form.last_name} onChange={update} error={fieldError(errors, 'last_name')} />
        <Input label="Phone" name="phone" type="tel" value={form.phone} onChange={update} error={fieldError(errors, 'phone')} />
        <Select label="Role" name="role_id" value={form.role_id} onChange={update} error={fieldError(errors, 'role_id')}><option value="">No role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select>
        {!isEdit && <><Input label="Password" name="password" type="password" value={form.password} onChange={update} error={fieldError(errors, 'password')} required autoComplete="new-password" /><Input label="Confirm password" name="password_confirm" type="password" value={form.password_confirm} onChange={update} error={fieldError(errors, 'password_confirm')} required autoComplete="new-password" /></>}
        <label className="checkbox field--full"><input type="checkbox" name="is_active" checked={form.is_active} onChange={update} /><span><strong>Active account</strong><small>Inactive users cannot authenticate or use refresh tokens.</small></span></label>
      </form>
    </Modal>
  )
}

function PasswordResetModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ new_password: '', new_password_confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setForm({ new_password: '', new_password_confirm: '' }); setError('') }, [user])
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try { await userService.resetPassword(user.id, form); onSaved() } catch (requestError) { setError(getApiError(requestError).message) } finally { setSaving(false) }
  }
  return <Modal open={Boolean(user)} onClose={onClose} title={`Reset ${user?.username || ''}'s password`} size="small" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="reset-password-form" loading={saving}>Reset password</Button></>}><form id="reset-password-form" className="form-stack" onSubmit={submit}>{error && <div className="form-alert" role="alert">{error}</div>}<Input label="New password" type="password" value={form.new_password} onChange={(event) => setForm((current) => ({ ...current, new_password: event.target.value }))} autoComplete="new-password" required /><Input label="Confirm new password" type="password" value={form.new_password_confirm} onChange={(event) => setForm((current) => ({ ...current, new_password_confirm: event.target.value }))} autoComplete="new-password" required /></form></Modal>
}
