import { useCallback, useEffect, useMemo, useState } from 'react'
import { HandCoins, Pencil, Plus, Trash2 } from 'lucide-react'

import PermissionGate from '../../../components/auth/PermissionGate'
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, LoadingSpinner, PageHeader, Pagination, SearchInput, Select, Table } from '../../../components/ui'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import ContributionForm from '../components/ContributionForm'
import MoneyStack from '../components/MoneyStack'
import { useFinanceLookups } from '../hooks'
import { formatDate, formatMoney, initials, statusTone } from '../utils'

const PAGE_SIZE = 15

export default function ContributionsPage() {
  const [data, setData] = useState({ results: [], count: 0 })
  const [summary, setSummary] = useState({ AFN: '0.00', USD: '0.00' })
  const [filters, setFilters] = useState({ search: '', member: '', currency: '', status: '' })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [voidTarget, setVoidTarget] = useState(null)
  const [acting, setActing] = useState(false)
  const { members } = useFinanceLookups()
  const { hasPermission } = useAuth()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [rows, dashboard] = await Promise.all([
        financeService.contributions.list({ ...filters, page, page_size: PAGE_SIZE, ordering: '-date' }),
        financeService.dashboard({ member: filters.member, currency: filters.currency }),
      ])
      setData(rows); setSummary(dashboard.summary.total_contributions)
    } catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [filters, page])
  useEffect(() => { load() }, [load])

  const voidContribution = async () => {
    setActing(true)
    try {
      await financeService.contributions.void(voidTarget.id)
      addToast({ type: 'success', title: 'Contribution voided', message: 'Balances were recalculated without deleting the audit record.' })
      setVoidTarget(null); load()
    } catch (requestError) { addToast({ type: 'error', title: 'Could not void contribution', message: getApiError(requestError).message }) }
    finally { setActing(false) }
  }

  const columns = useMemo(() => [
    { key: 'member', label: 'Founder / member', render: (row) => <div className="identity-cell"><span className="avatar avatar--table">{initials(row.member)}</span><div><strong>{row.member.full_name}</strong><span>@{row.member.username}</span></div></div> },
    { key: 'description', label: 'Contribution', render: (row) => <div className="primary-cell"><span>{row.description}</span><small>{row.reference || 'No reference'}</small></div> },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    { key: 'amount', label: 'Amount', render: (row) => <strong className="table-money money--positive">+{formatMoney(row.amount, row.currency)}</strong> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status_display}</Badge> },
    { key: 'actions', label: 'Actions', className: 'table-actions', render: (row) => row.status !== 'VOIDED' && hasPermission('finance.contributions.edit') ? <div className="action-group"><Button className="table-action-button" size="small" variant="ghost" onClick={() => setEditor(row)} title="Edit contribution"><Pencil size={16} /></Button><Button className="table-action-button" size="small" variant="danger-ghost" onClick={() => setVoidTarget(row)} title="Void contribution"><Trash2 size={16} /></Button></div> : null },
  ], [hasPermission])
  const updateFilter = (event) => { const { name, value } = event.target; setPage(1); setFilters((current) => ({ ...current, [name]: value })) }

  return (
    <div className="page finance-page">
      <PageHeader
        eyebrow="Money in"
        title="Founder Contributions"
        description="Record capital added by founders and members independently from company spending."
        actions={<PermissionGate permission="finance.contributions.create"><Button onClick={() => setEditor('create')}><Plus size={17} />Add contribution</Button></PermissionGate>}
      />
      <section className="contribution-summary">
        <span><HandCoins size={20} /></span>
        <div><small>Recorded contributions</small><MoneyStack totals={summary} /></div>
        <p>These funds increase company cash and each member’s funding position.</p>
      </section>
      <section className="panel">
        <div className="panel__toolbar">
          <SearchInput value={filters.search} onSearch={(search) => { setPage(1); setFilters((current) => ({ ...current, search })) }} placeholder="Search descriptions or references…" />
          <span className="result-count">{data.count || 0} contribution{data.count === 1 ? '' : 's'}</span>
        </div>
        <div className="finance-filters finance-filters--compact">
          <Select label="Member" name="member" value={filters.member} onChange={updateFilter}><option value="">All members</option>{members.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</Select>
          <Select label="Currency" name="currency" value={filters.currency} onChange={updateFilter}><option value="">AFN &amp; USD</option><option value="AFN">AFN</option><option value="USD">USD</option></Select>
          <Select label="Status" name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option><option value="RECORDED">Recorded</option><option value="VOIDED">Voided</option></Select>
        </div>
        {loading ? <div className="panel__state"><LoadingSpinner label="Loading contributions" /></div>
          : error ? <ErrorState message={error} onRetry={load} />
            : <><Table columns={columns} data={data.results || []} empty={<EmptyState title="No contributions yet" message="Record founder funding to establish company cash and member positions." action={hasPermission('finance.contributions.create') ? <Button onClick={() => setEditor('create')}>Add contribution</Button> : null} />} /><Pagination page={page} total={data.count || 0} pageSize={PAGE_SIZE} onChange={setPage} /></>}
      </section>
      <ContributionForm open={Boolean(editor)} contribution={editor === 'create' ? null : editor} members={members} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load() }} />
      <ConfirmDialog open={Boolean(voidTarget)} onClose={() => setVoidTarget(null)} onConfirm={voidContribution} loading={acting} danger title="Void contribution?" message="This keeps the audit record but removes the amount from financial calculations. Use it only to correct an invalid entry." confirmLabel="Void contribution" />
    </div>
  )
}
