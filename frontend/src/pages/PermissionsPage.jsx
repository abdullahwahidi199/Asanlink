import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge, ErrorState, LoadingSpinner, PageHeader, Table } from '../components/ui'
import { getApiError } from '../services/errorService'
import permissionService from '../services/permissionService'

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await permissionService.list({ page_size: 250, ordering: 'module,action' })
      setPermissions(data.results || data)
    } catch (requestError) {
      setError(getApiError(requestError).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const columns = useMemo(() => [
    { key: 'name', label: 'Permission', render: (item) => <div className="primary-cell"><strong>{item.name}</strong><code>{item.codename}</code></div> },
    { key: 'module', label: 'Module', render: (item) => <Badge tone="info">{item.module}</Badge> },
    { key: 'action', label: 'Action', render: (item) => <span className="capitalize">{item.action}</span> },
    { key: 'description', label: 'Description' },
  ], [])

  return (
    <div className="page">
      <PageHeader eyebrow="Authorization" title="Permissions" description="System-registered capabilities available for role assignment. Permission records are read-only through the API." />
      <section className="panel">
        <div className="panel__header"><div><h2>Permission registry</h2><p>{permissions.length} active permissions across {new Set(permissions.map((item) => item.module)).size} modules</p></div></div>
        {loading ? <div className="panel__state"><LoadingSpinner label="Loading permissions" /></div> : error ? <ErrorState message={error} onRetry={load} /> : <Table columns={columns} data={permissions} />}
      </section>
    </div>
  )
}

