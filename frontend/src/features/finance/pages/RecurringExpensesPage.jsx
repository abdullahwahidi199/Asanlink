import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Pause, Pencil, Play, Plus, RefreshCw } from 'lucide-react'

import PermissionGate from '../../../components/auth/PermissionGate'
import { Badge, Button, EmptyState, ErrorState, LoadingSpinner, PageHeader, Select, Table } from '../../../components/ui'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import RecurringExpenseForm from '../components/RecurringExpenseForm'
import { useFinanceLookups } from '../hooks'
import { formatDate, formatMoney, initials, today } from '../utils'

export default function RecurringExpensesPage() {
  const [data, setData] = useState({ results: [], count: 0 })
  const [filters, setFilters] = useState({ currency: '', active: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [acting, setActing] = useState(null)
  const { members, categories } = useFinanceLookups()
  const { hasPermission } = useAuth()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await financeService.recurring.list({ ...filters, page_size: 100 })) }
    catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [filters])
  useEffect(() => { load() }, [load])

  const toggle = async (rule) => {
    setActing(`toggle-${rule.id}`)
    try { await financeService.recurring.toggle(rule.id, !rule.is_active); addToast({ type: 'success', title: rule.is_active ? 'Schedule paused' : 'Schedule resumed', message: `${rule.name} was updated.` }); load() }
    catch (requestError) { addToast({ type: 'error', title: 'Schedule update failed', message: getApiError(requestError).message }) }
    finally { setActing(null) }
  }
  const generate = async (rule) => {
    setActing(`generate-${rule.id}`)
    try { const result = await financeService.recurring.generate(rule.id, today()); addToast({ type: 'success', title: result.created ? 'Draft expenses generated' : 'Schedule is current', message: result.created ? `${result.created} due occurrence${result.created === 1 ? '' : 's'} added as draft expenses.` : 'No missing occurrence was found.' }); load() }
    catch (requestError) { addToast({ type: 'error', title: 'Generation failed', message: getApiError(requestError).message }) }
    finally { setActing(null) }
  }

  const columns = useMemo(() => [
    { key: 'name', label: 'Recurring expense', render: (row) => <div className="primary-cell"><span>{row.name}</span><small>{row.vendor || row.category.name}</small></div> },
    { key: 'paid_by', label: 'Paid by', render: (row) => <div className="identity-cell"><span className="avatar avatar--table">{initials(row.paid_by)}</span><div><strong>{row.paid_by.full_name}</strong><span>{row.payment_source_display}</span></div></div> },
    { key: 'frequency', label: 'Frequency', render: (row) => row.frequency_display },
    { key: 'next', label: 'Next occurrence', render: (row) => <div className="primary-cell"><span>{formatDate(row.next_occurrence)}</span><small>{row.end_date ? `Ends ${formatDate(row.end_date)}` : 'No end date'}</small></div> },
    { key: 'amount', label: 'Amount', render: (row) => <strong className="table-money">{formatMoney(row.amount, row.currency)}</strong> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Paused'}</Badge> },
    { key: 'actions', label: 'Actions', className: 'table-actions', render: (row) => hasPermission('finance.recurring.manage') ? <div className="action-group"><Button size="small" variant="ghost" className="table-action-button" onClick={() => setEditor(row)} title="Edit schedule"><Pencil size={16} /></Button><Button size="small" variant="ghost" className="table-action-button" loading={acting === `generate-${row.id}`} disabled={!row.is_active} onClick={() => generate(row)} title="Generate due expense"><RefreshCw size={16} /></Button><Button size="small" variant="ghost" className="table-action-button" loading={acting === `toggle-${row.id}`} onClick={() => toggle(row)} title={row.is_active ? 'Pause schedule' : 'Resume schedule'}>{row.is_active ? <Pause size={16} /> : <Play size={16} />}</Button></div> : null },
  ], [acting, hasPermission])

  return <div className="page finance-page">
    <PageHeader eyebrow="Predictable spending" title="Recurring Expenses" description="Manage hosting, domains, subscriptions, and other repeating costs without duplicate occurrences." actions={<PermissionGate permission="finance.recurring.manage"><Button onClick={() => setEditor('create')}><Plus size={17} />Add recurring expense</Button></PermissionGate>} />
    <section className="recurring-banner"><span><CalendarClock size={22} /></span><div><strong>Controlled automation</strong><p>Occurrences are generated as drafts. They still follow the normal submit, approve, and record workflow.</p></div></section>
    <section className="panel"><div className="panel__toolbar"><div className="filter-inline"><Select aria-label="Currency" value={filters.currency} onChange={(event) => setFilters((current) => ({ ...current, currency: event.target.value }))}><option value="">AFN &amp; USD</option><option value="AFN">AFN</option><option value="USD">USD</option></Select><Select aria-label="Schedule status" value={filters.active} onChange={(event) => setFilters((current) => ({ ...current, active: event.target.value }))}><option value="">All schedules</option><option value="true">Active</option><option value="false">Paused</option></Select></div><span className="result-count">{data.count ?? (data.results || data).length} schedule{data.count === 1 ? '' : 's'}</span></div>
      {loading ? <div className="panel__state"><LoadingSpinner label="Loading recurring expenses" /></div> : error ? <ErrorState message={error} onRetry={load} /> : <Table columns={columns} data={data.results || data || []} empty={<EmptyState title="No recurring expenses" message="Create a schedule for predictable company costs such as hosting or SaaS subscriptions." action={hasPermission('finance.recurring.manage') ? <Button onClick={() => setEditor('create')}>Add recurring expense</Button> : null} />} />}
    </section>
    <RecurringExpenseForm open={Boolean(editor)} rule={editor === 'create' ? null : editor} members={members} categories={categories} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load() }} />
  </div>
}
