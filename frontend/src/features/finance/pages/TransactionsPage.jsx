import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, Filter, RotateCcw } from 'lucide-react'
import { Link } from 'react-router'

import PermissionGate from '../../../components/auth/PermissionGate'
import { Badge, Button, EmptyState, ErrorState, LoadingSpinner, PageHeader, Pagination, SearchInput, Select, Table } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import { useFinanceLookups } from '../hooks'
import { formatDate, formatMoney, initials, statusTone, typeTone } from '../utils'

const initialFilters = { search: '', date_from: '', date_to: '', member: '', type: '', category: '', currency: '', project: '', product: '', status: '' }
const PAGE_SIZE = 25

export default function TransactionsPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [data, setData] = useState({ results: [], count: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')
  const { members, categories } = useFinanceLookups()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await financeService.transactions({ ...filters, page, page_size: PAGE_SIZE })) }
    catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [filters, page])
  useEffect(() => { load() }, [load])

  const updateFilter = (event) => {
    const { name, value } = event.target
    setPage(1); setFilters((current) => ({ ...current, [name]: value }))
  }
  const exportFile = async (format) => {
    setExporting(format)
    try { await financeService.exportTransactions(format, filters); addToast({ type: 'success', title: `${format.toUpperCase()} ready`, message: 'The export reflects your active ledger filters.' }) }
    catch (requestError) { addToast({ type: 'error', title: 'Export failed', message: getApiError(requestError).message }) }
    finally { setExporting('') }
  }

  const columns = useMemo(() => [
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    { key: 'type', label: 'Type', render: (row) => <Badge tone={typeTone(row.type)}>{row.type[0]}{row.type.slice(1).toLowerCase()}</Badge> },
    { key: 'member', label: 'Member', render: (row) => <div className="identity-cell"><span className="avatar avatar--table">{initials(row.member)}</span><div><strong>{row.member.full_name}</strong>{row.counterparty && <span>to {row.counterparty.full_name}</span>}</div></div> },
    { key: 'description', label: 'Description', render: (row) => <div className="primary-cell"><span>{row.description}</span><small>{row.category}</small></div> },
    { key: 'allocation', label: 'Project / Product', render: (row) => <div className="primary-cell"><span>{row.project || '—'}</span><small>{row.product || 'No product'}</small></div> },
    { key: 'amount', label: 'Amount', render: (row) => <strong className={`table-money transaction-amount--${row.type.toLowerCase()}`}>{row.type === 'CONTRIBUTION' ? '+' : row.type === 'EXPENSE' ? '−' : ''}{formatMoney(row.amount, row.currency)}</strong> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status.replaceAll('_', ' ').toLowerCase()}</Badge> },
    { key: 'actions', label: '', className: 'table-actions', render: (row) => row.detail_url ? <Link className="button button--ghost button--small table-action-button" to={row.detail_url} aria-label="View transaction"><ExternalLink size={15} /></Link> : null },
  ], [])
  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="page finance-page">
      <PageHeader eyebrow="Unified ledger" title="Transactions" description="Search and filter expenses, contributions, and member settlements without mixing their meaning." actions={<PermissionGate permission="finance.reports.export"><div className="split-actions"><Button variant="secondary" loading={exporting === 'csv'} onClick={() => exportFile('csv')}><Download size={16} />CSV</Button><Button variant="secondary" loading={exporting === 'pdf'} onClick={() => exportFile('pdf')}><Download size={16} />PDF</Button></div></PermissionGate>} />
      <section className="panel ledger-panel">
        <div className="panel__toolbar ledger-toolbar"><SearchInput value={filters.search} onSearch={(search) => { setPage(1); setFilters((current) => ({ ...current, search })) }} placeholder="Search description, vendor, member…" /><div className="ledger-toolbar__meta"><span><Filter size={14} />{activeCount} active filter{activeCount === 1 ? '' : 's'}</span>{activeCount > 0 && <Button size="small" variant="ghost" onClick={() => { setFilters(initialFilters); setPage(1) }}><RotateCcw size={14} />Reset</Button>}</div></div>
        <div className="finance-filters">
          <label><span>From</span><input className="input" name="date_from" type="date" value={filters.date_from} onChange={updateFilter} /></label>
          <label><span>To</span><input className="input" name="date_to" type="date" value={filters.date_to} onChange={updateFilter} /></label>
          <Select label="Member" name="member" value={filters.member} onChange={updateFilter}><option value="">All members</option>{members.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</Select>
          <Select label="Type" name="type" value={filters.type} onChange={updateFilter}><option value="">All transaction types</option><option value="EXPENSE">Expenses</option><option value="CONTRIBUTION">Contributions</option><option value="SETTLEMENT">Settlements</option></Select>
          <Select label="Category" name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select label="Currency" name="currency" value={filters.currency} onChange={updateFilter}><option value="">AFN & USD</option><option value="AFN">AFN</option><option value="USD">USD</option></Select>
          <label><span>Project</span><input className="input" name="project" value={filters.project} onChange={updateFilter} placeholder="All projects" /></label>
          <label><span>Product</span><input className="input" name="product" value={filters.product} onChange={updateFilter} placeholder="All products" /></label>
          <Select label="Status" name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option>{['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'RECORDED', 'OUTSTANDING', 'PARTIAL', 'VOIDED'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</Select>
        </div>
        {loading ? <div className="panel__state"><LoadingSpinner label="Loading ledger" /></div> : error ? <ErrorState message={error} onRetry={load} /> : <><Table columns={columns} data={data.results || []} empty={<EmptyState title="No transactions found" message={activeCount ? 'Adjust or reset your filters to see more activity.' : 'Add an expense or contribution to start the company ledger.'} />} /><Pagination page={page} total={data.count || 0} pageSize={PAGE_SIZE} onChange={setPage} /></>}
      </section>
    </div>
  )
}
