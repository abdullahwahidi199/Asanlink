import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSpinner,
  Modal,
  SearchInput,
  Table,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getApiError } from '../../services/errorService'
import websiteService from '../../services/websiteService'
import EditorFields from './EditorFields'
import { initialForm, preparePayload } from './formUtils'
import useWebsiteOptions from './useWebsiteOptions'

const statusTone = { published: 'success', draft: 'warning', archived: 'neutral' }

const itemTitle = (definition, item) => typeof definition.titleField === 'function'
  ? definition.titleField(item)
  : item[definition.titleField]

export default function ResourceManager({ definition }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [actionId, setActionId] = useState(null)
  const { hasPermission } = useAuth()
  const { addToast } = useToast()
  const loadedOptions = useWebsiteOptions(definition.fields)
  const options = definition.fields.some((field) => field.optionResource === definition.resource)
    ? { ...loadedOptions, [definition.resource]: items }
    : loadedOptions
  const canManage = hasPermission(definition.permission)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await websiteService.list(definition.resource, { ordering: definition.ordered ? 'display_order' : undefined }))
    } catch (requestError) {
      setError(getApiError(requestError).message)
    } finally {
      setLoading(false)
    }
  }, [definition])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) => `${itemTitle(definition, item) || ''} ${definition.summary?.(item) || ''}`.toLowerCase().includes(query))
  }, [definition, items, search])

  const save = async (payload) => {
    if (editor === 'create') await websiteService.create(definition.resource, payload)
    else await websiteService.update(definition.resource, editor.id, payload)
    addToast({ type: 'success', title: `${definition.singular} saved`, message: 'The CMS record was updated successfully.' })
    setEditor(null)
    await load()
  }

  const changePublication = async (item, nextAction) => {
    setActionId(item.id)
    try {
      await websiteService.setPublication(definition.resource, item.id, nextAction)
      addToast({ type: 'success', title: `${definition.singular} updated`, message: `Publication state changed to ${nextAction}.` })
      await load()
    } catch (requestError) {
      addToast({ type: 'error', title: 'Publication update failed', message: getApiError(requestError).message })
    } finally {
      setActionId(null)
    }
  }

  const remove = async () => {
    if (!confirmation) return
    setActionId(confirmation.id)
    try {
      await websiteService.remove(definition.resource, confirmation.id)
      addToast({ type: 'success', title: `${definition.singular} deleted`, message: 'The record was permanently removed.' })
      setConfirmation(null)
      await load()
    } catch (requestError) {
      addToast({ type: 'error', title: 'Delete failed', message: getApiError(requestError).message })
    } finally {
      setActionId(null)
    }
  }

  const columns = (() => {
    const result = [
      {
        key: 'identity',
        label: definition.singular,
        render: (item) => <div className="primary-cell"><strong>{itemTitle(definition, item) || `#${item.id}`}</strong><span>{definition.summary?.(item) || ''}</span></div>,
      },
    ]
    if (definition.publishable) result.push({ key: 'status', label: 'Publication', render: (item) => <Badge tone={statusTone[item.status] || 'neutral'}>{item.status}</Badge> })
    if (definition.fields.some((field) => field.name === 'is_visible' || field.name === 'is_enabled' || field.name === 'is_public' || field.name === 'is_active')) {
      result.push({ key: 'visibility', label: 'Visibility', render: (item) => {
        const value = item.is_visible ?? item.is_enabled ?? item.is_public ?? item.is_active
        return <Badge tone={value ? 'success' : 'neutral'}>{value ? 'Enabled' : 'Hidden'}</Badge>
      } })
    }
    if (definition.ordered) result.push({ key: 'order', label: 'Order', render: (item) => item.display_order })
    if (canManage) result.push({
      key: 'actions', label: 'Actions', className: 'table-actions', render: (item) => (
        <div className="action-group">
          {definition.publishable && item.status !== 'published' && <Button className="table-action-button" size="small" variant="ghost" loading={actionId === item.id} onClick={() => changePublication(item, 'publish')} aria-label={`Publish ${itemTitle(definition, item)}`} title="Publish"><Eye size={16} /></Button>}
          {definition.publishable && item.status === 'published' && <Button className="table-action-button" size="small" variant="ghost" loading={actionId === item.id} onClick={() => changePublication(item, 'unpublish')} aria-label={`Unpublish ${itemTitle(definition, item)}`} title="Move to draft"><EyeOff size={16} /></Button>}
          {definition.publishable && item.status !== 'archived' && <Button className="table-action-button" size="small" variant="ghost" loading={actionId === item.id} onClick={() => changePublication(item, 'archive')} aria-label={`Archive ${itemTitle(definition, item)}`} title="Archive"><Archive size={16} /></Button>}
          <Button className="table-action-button" size="small" variant="ghost" onClick={() => setEditor(item)} aria-label={`Edit ${itemTitle(definition, item)}`} title="Edit"><Pencil size={16} /></Button>
          <Button className="table-action-button" size="small" variant="danger-ghost" onClick={() => setConfirmation(item)} aria-label={`Delete ${itemTitle(definition, item)}`} title="Delete"><Trash2 size={16} /></Button>
        </div>
      ),
    })
    return result
  })()

  return (
    <section className="panel website-resource">
      <div className="panel__header website-resource__header">
        <div><h2>{definition.title}</h2><p>{definition.description}</p></div>
        {canManage ? <Button size="small" onClick={() => setEditor('create')}>Add {definition.singular}</Button> : <Badge tone="neutral">View only</Badge>}
      </div>
      <div className="panel__toolbar"><SearchInput value={search} onSearch={setSearch} placeholder={`Search ${definition.title.toLowerCase()}`} /><span className="result-count">{filtered.length} records</span></div>
      {loading ? <div className="panel__state"><LoadingSpinner label={`Loading ${definition.title}`} /></div> : error ? <ErrorState message={error} onRetry={load} /> : <Table columns={columns} data={filtered} empty={<EmptyState title={`No ${definition.title.toLowerCase()}`} message="Create the first CMS record when content is ready." />} />}

      <ResourceEditor
        key={editor === 'create' ? 'create' : editor?.id || 'closed'}
        definition={definition}
        editor={editor}
        options={options}
        onClose={() => setEditor(null)}
        onSave={save}
      />
      <ConfirmDialog
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        onConfirm={remove}
        loading={Boolean(confirmation && actionId === confirmation.id)}
        danger
        title={`Delete ${definition.singular}`}
        message={confirmation ? `Permanently delete ${itemTitle(definition, confirmation)}? Use archived status instead when the record may be needed later.` : ''}
        confirmLabel="Delete permanently"
      />
    </section>
  )
}

function ResourceEditor({ definition, editor, options, onClose, onSave }) {
  const item = editor === 'create' ? null : editor
  const [form, setForm] = useState(() => initialForm(definition.fields, item))
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const prepared = preparePayload(definition.fields, form)
    if (Object.keys(prepared.localErrors).length) {
      setErrors(prepared.localErrors)
      return
    }
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      await onSave(prepared.payload)
    } catch (requestError) {
      const parsed = getApiError(requestError, `The ${definition.singular} could not be saved.`)
      setMessage(parsed.message)
      setErrors(parsed.fields)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(editor)}
      onClose={onClose}
      title={`${item ? 'Edit' : 'Add'} ${definition.singular}`}
      description="Content and relationships are validated by the CMS API."
      size="large"
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form={`website-resource-${definition.resource}`} loading={saving}>Save</Button></>}
    >
      {message && <div className="form-alert" role="alert">{message}</div>}
      <form id={`website-resource-${definition.resource}`} className="form-grid" onSubmit={submit}>
        <EditorFields fields={definition.fields} form={form} setForm={setForm} errors={errors} options={options} disabled={saving} isCreate={!item} />
      </form>
    </Modal>
  )
}
