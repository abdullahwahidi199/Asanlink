import { useCallback, useEffect, useState } from 'react'

import { Badge, Button, ErrorState, LoadingSpinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getApiError } from '../../services/errorService'
import websiteService from '../../services/websiteService'
import EditorFields from './EditorFields'
import { initialForm, preparePayload } from './formUtils'
import useWebsiteOptions from './useWebsiteOptions'

export default function ConfigEditor({ definition }) {
  const [form, setForm] = useState(() => initialForm(definition.fields))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const { hasPermission } = useAuth()
  const { addToast } = useToast()
  const options = useWebsiteOptions(definition.fields)
  const canManage = hasPermission(definition.permission)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await websiteService.getConfig(definition.endpoint)
      setForm(initialForm(definition.fields, data))
    } catch (requestError) {
      setError(getApiError(requestError).message)
    } finally {
      setLoading(false)
    }
  }, [definition])

  useEffect(() => { load() }, [load])

  const submit = async (event) => {
    event.preventDefault()
    const prepared = preparePayload(definition.fields, form)
    if (Object.keys(prepared.localErrors).length) {
      setErrors(prepared.localErrors)
      return
    }
    setSaving(true)
    setError('')
    setErrors({})
    try {
      const data = await websiteService.updateConfig(definition.endpoint, prepared.payload)
      setForm(initialForm(definition.fields, data))
      addToast({ type: 'success', title: 'Website settings saved', message: `${definition.title} now uses the saved CMS values.` })
    } catch (requestError) {
      const parsed = getApiError(requestError, 'The settings could not be saved.')
      setError(parsed.message)
      setErrors(parsed.fields)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel website-config">
      <div className="panel__header">
        <div><h2>{definition.title}</h2><p>{definition.description}</p></div>
        {!canManage && <Badge tone="neutral">View only</Badge>}
      </div>
      {loading ? <div className="panel__state"><LoadingSpinner label={`Loading ${definition.title}`} /></div> : error && !Object.keys(errors).length ? <ErrorState message={error} onRetry={load} /> : (
        <form className="website-config__form form-grid" onSubmit={submit}>
          {error && <div className="form-alert field--full" role="alert">{error}</div>}
          <EditorFields fields={definition.fields} form={form} setForm={setForm} errors={errors} options={options} disabled={!canManage || saving} />
          {canManage && <div className="website-form-actions field--full"><Button type="submit" loading={saving}>Save settings</Button></div>}
        </form>
      )}
    </section>
  )
}
