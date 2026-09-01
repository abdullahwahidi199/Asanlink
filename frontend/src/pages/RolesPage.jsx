import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Power, PowerOff, Trash2 } from 'lucide-react'

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
  Table,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fieldError, getApiError } from '../services/errorService'
import permissionService from '../services/permissionService'
import roleService from '../services/roleService'

export default function RolesPage() {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const { hasPermission } = useAuth()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const rolesData = await roleService.list({ page_size: 250, ordering: 'name' })
      setRoles(rolesData.results || rolesData)
      if (hasPermission('permissions.view')) {
        const permissionData = await permissionService.list({ page_size: 250, ordering: 'module,action' })
        setPermissions(permissionData.results || permissionData)
      }
    } catch (requestError) {
      setError(getApiError(requestError).message)
    } finally { setLoading(false) }
  }, [hasPermission])

  useEffect(() => { load() }, [load])

  const saveRole = async (payload) => {
    if (editor === 'create') await roleService.create(payload)
    else await roleService.update(editor.id, payload)
    addToast({ type: 'success', title: editor === 'create' ? 'Role created' : 'Role updated', message: `${payload.name} was saved with ${payload.permission_ids.length} permissions.` })
    setEditor(null); await load()
  }

  const runConfirmedAction = async () => {
    if (!confirmation) return
    setActionLoading(true)
    try {
      if (confirmation.type === 'delete') await roleService.remove(confirmation.role.id)
      if (confirmation.type === 'activate') await roleService.activate(confirmation.role.id)
      if (confirmation.type === 'deactivate') await roleService.deactivate(confirmation.role.id)
      addToast({ type: 'success', title: 'Role updated', message: `${confirmation.role.name} was ${confirmation.type === 'delete' ? 'deleted' : `${confirmation.type}d`}.` })
      setConfirmation(null); await load()
    } catch (requestError) {
      addToast({ type: 'error', title: 'Action failed', message: getApiError(requestError).message })
    } finally { setActionLoading(false) }
  }

  const columns = useMemo(() => {
    const result = [
      { key: 'name', label: 'Role', render: (role) => <div className="primary-cell"><strong>{role.name}</strong><span>{role.description || 'No description'}</span></div> },
      { key: 'users_count', label: 'Users', render: (role) => role.users_count },
      { key: 'permissions', label: 'Permissions', render: (role) => <Badge tone="info">{role.name === 'ADMIN' ? `${permissions.length || role.permissions.length} (dynamic)` : role.permissions.length}</Badge> },
      { key: 'is_active', label: 'Status', render: (role) => <Badge tone={role.is_active ? 'success' : 'danger'}>{role.is_active ? 'Active' : 'Inactive'}</Badge> },
      { key: 'type', label: 'Type', render: (role) => <Badge tone={role.is_system ? 'neutral' : 'warning'}>{role.is_system ? 'System' : 'Custom'}</Badge> },
    ]
    if (hasPermission('roles.update') || hasPermission('roles.delete')) {
      result.push({
        key: 'actions',
        label: 'Actions',
        className: 'table-actions',
        render: (role) => (
          <div className="action-group">
            <PermissionGate permission="roles.update">
              <Button className="table-action-button" size="small" variant="ghost" onClick={() => setEditor(role)} aria-label={`Edit ${role.name}`} title="Edit role">
                <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />
              </Button>
              {role.name !== 'ADMIN' && (
                <Button
                  className="table-action-button"
                  size="small"
                  variant="ghost"
                  onClick={() => setConfirmation({ type: role.is_active ? 'deactivate' : 'activate', role })}
                  aria-label={`${role.is_active ? 'Deactivate' : 'Activate'} ${role.name}`}
                  title={`${role.is_active ? 'Deactivate' : 'Activate'} role`}
                >
                  {role.is_active
                    ? <PowerOff size={16} strokeWidth={1.8} aria-hidden="true" />
                    : <Power size={16} strokeWidth={1.8} aria-hidden="true" />}
                </Button>
              )}
            </PermissionGate>
            <PermissionGate permission="roles.delete">
              {!role.is_system && (
                <Button className="table-action-button" size="small" variant="danger-ghost" onClick={() => setConfirmation({ type: 'delete', role })} aria-label={`Delete ${role.name}`} title="Delete role">
                  <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                </Button>
              )}
            </PermissionGate>
          </div>
        ),
      })
    }
    return result
  }, [hasPermission, permissions.length])

  return (
    <div className="page">
      <PageHeader eyebrow="Authorization" title="Roles" description="Bundle database permissions into reusable access profiles." actions={<PermissionGate permission="roles.create"><Button onClick={() => setEditor('create')}>Create role</Button></PermissionGate>} />
      <section className="panel">
        <div className="panel__header"><div><h2>Available roles</h2><p>{roles.length} roles currently registered</p></div></div>
        {loading ? <div className="panel__state"><LoadingSpinner label="Loading roles" /></div> : error ? <ErrorState message={error} onRetry={load} /> : <Table columns={columns} data={roles} empty={<EmptyState title="No roles found" message="Create a role to begin assigning access." />} />}
      </section>

      <RoleEditor open={Boolean(editor)} role={editor === 'create' ? null : editor} permissions={permissions} canViewPermissions={hasPermission('permissions.view')} onClose={() => setEditor(null)} onSubmit={saveRole} />
      <ConfirmDialog open={Boolean(confirmation)} onClose={() => setConfirmation(null)} onConfirm={runConfirmedAction} loading={actionLoading} danger={confirmation?.type !== 'activate'} title={`${confirmation?.type === 'delete' ? 'Delete' : confirmation?.type === 'deactivate' ? 'Deactivate' : 'Activate'} role`} message={confirmation ? `${confirmation.type === 'delete' ? 'Permanently delete' : `${confirmation.type[0].toUpperCase()}${confirmation.type.slice(1)}`} ${confirmation.role.name}?${confirmation.type === 'delete' ? ' Assigned users must be moved first.' : ''}` : ''} confirmLabel={confirmation?.type === 'delete' ? 'Delete role' : 'Confirm'} />
    </div>
  )
}

function RoleEditor({ open, role, permissions, canViewPermissions, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', description: '', is_active: true, permission_ids: [] })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(role)

  useEffect(() => {
    setForm(role ? { name: role.name, description: role.description || '', is_active: role.is_active, permission_ids: role.permissions.map((item) => item.id) } : { name: '', description: '', is_active: true, permission_ids: [] })
    setErrors({}); setMessage('')
  }, [role, open])

  const grouped = useMemo(() => permissions.reduce((result, permission) => {
    const key = permission.module
    if (!result[key]) result[key] = []
    result[key].push(permission)
    return result
  }, {}), [permissions])

  const togglePermission = (id) => setForm((current) => ({ ...current, permission_ids: current.permission_ids.includes(id) ? current.permission_ids.filter((value) => value !== id) : [...current.permission_ids, id] }))
  const toggleModule = (modulePermissions) => {
    const ids = modulePermissions.map((item) => item.id)
    const allSelected = ids.every((id) => form.permission_ids.includes(id))
    setForm((current) => ({ ...current, permission_ids: allSelected ? current.permission_ids.filter((id) => !ids.includes(id)) : [...new Set([...current.permission_ids, ...ids])] }))
  }

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(''); setErrors({})
    try { await onSubmit(form) } catch (requestError) { const parsed = getApiError(requestError, 'The role could not be saved.'); setMessage(parsed.message); setErrors(parsed.fields) } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${role.name}` : 'Create role'} description="Choose only the actions this role should be able to perform." size="large" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="role-form" loading={saving}>{isEdit ? 'Save role' : 'Create role'}</Button></>}>
      {message && <div className="form-alert" role="alert">{message}</div>}
      <form id="role-form" className="form-stack" onSubmit={submit}>
        <div className="form-grid"><Input label="Role name" name="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} error={fieldError(errors, 'name')} required disabled={role?.name === 'ADMIN'} /><div className="field"><label htmlFor="role-description">Description</label><textarea id="role-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="3" /></div><label className="checkbox field--full"><input type="checkbox" checked={form.is_active} disabled={role?.name === 'ADMIN'} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /><span><strong>Active role</strong><small>Users assigned to an inactive role have no effective role permissions.</small></span></label></div>
        <div className="permission-editor"><div className="permission-editor__heading"><div><h3>Permissions</h3><p>{form.permission_ids.length} selected</p></div></div>
          {!canViewPermissions ? <div className="form-alert">Your role cannot view the permission registry. Existing assignments will be preserved only if this form is closed without saving.</div> : Object.entries(grouped).map(([module, items]) => {
            const allSelected = items.every((item) => form.permission_ids.includes(item.id))
            return <fieldset className="permission-group" key={module}><legend><label><input type="checkbox" checked={allSelected} onChange={() => toggleModule(items)} /><span>{module.replaceAll('.', ' / ')}</span></label></legend><div>{items.map((permission) => <label className="permission-option" key={permission.id}><input type="checkbox" checked={form.permission_ids.includes(permission.id)} onChange={() => togglePermission(permission.id)} /><span><strong>{permission.action}</strong><small>{permission.description}</small></span></label>)}</div></fieldset>
          })}
        </div>
      </form>
    </Modal>
  )
}
