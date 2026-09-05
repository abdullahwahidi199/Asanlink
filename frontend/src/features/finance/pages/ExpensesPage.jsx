import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Send } from 'lucide-react'
import { Link } from 'react-router'

import PermissionGate from '../../../components/auth/PermissionGate'
import { Badge, Button, EmptyState, ErrorState, LoadingSpinner, PageHeader, Pagination, SearchInput, Select, Table } from '../../../components/ui'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import ExpenseForm from '../components/ExpenseForm'
import { useFinanceLookups } from '../hooks'
import { formatDate, formatMoney, initials, statusTone } from '../utils'

const PAGE_SIZE = 15

export default function ExpensesPage() {
  const [data, setData] = useState({ results: [], count: 0 })
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ search: '', status: '', currency: '', payment_source: '', category: '', member: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [acting, setActing] = useState(null)
  const { members, categories } = useFinanceLookups()
  const { hasPermission } = useAuth()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await financeService.expenses.list({ ...filters, page, page_size: PAGE_SIZE, ordering: '-date' })) }
    catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [filters, page])
  useEffect(() => { load() }, [load])

  const submitExpense = async (expense) => {
    setActing(expense.id)
    try { await financeService.expenses.transition(expense.id, 'submit'); addToast({ type: 'success', title: 'Expense submitted', message: 'The expense is ready for an approver.' }); load() }
    catch (requestError) { addToast({ type: 'error', title: 'Submission failed', message: getApiError(requestError).message }) }
    finally { setActing(null) }
  }

  const columns = useMemo(() => [
    { key: 'expense', label: 'Expense', render: (row) => <div className="primary-cell"><span>{row.description}</span><small>{row.vendor || row.category.name}</small></div> },
    { key: 'paid_by', label: 'Paid by', render: (row) => <div className="identity-cell"><span className="avatar avatar--table">{initials(row.paid_by)}</span><div><strong>{row.paid_by.full_name}</strong><span>{row.payment_source === 'PERSONAL' ? 'Personal funds' : 'Company funds'}</span></div></div> },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    { key: 'category', label: 'Category', render: (row) => row.category.name },
    { key: 'amount', label: 'Amount', render: (row) => <strong className="table-money">{formatMoney(row.amount, row.currency)}</strong> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status_display}</Badge> },
    { key: 'actions', label: 'Actions', className: 'table-actions', render: (row) => <div className="action-group"><Link className="button button--ghost button--small table-action-button" to={`/finance/expenses/${row.id}`} title="View expense" aria-label={`View ${row.description}`}><Eye size={16} /></Link>{row.allowed_actions.includes('edit') && <Button className="table-action-button" size="small" variant="ghost" onClick={() => setEditor(row)} title="Edit expense"><Pencil size={16} /></Button>}{row.allowed_actions.includes('submit') && <Button className="table-action-button" size="small" variant="ghost" loading={acting === row.id} onClick={() => submitExpense(row)} title="Submit expense"><Send size={16} /></Button>}</div> },
  ], [acting])

  const updateFilter = (event) => { const { name, value } = event.target; setPage(1); setFilters((current) => ({ ...current, [name]: value })) }

  return (
    <div className="page finance-page">
      <PageHeader eyebrow="Expense management" title="Company Expenses" description="Capture receipts, allocate spend, and move every payment through a traceable approval workflow." actions={<PermissionGate permission="finance.expenses.create"><Button onClick={() => setEditor('create')}><Plus size={17} />Add expense</Button></PermissionGate>} />
      <section className="panel">
        <div className="panel__toolbar"><SearchInput value={filters.search} onSearch={(search) => { setPage(1); setFilters((current) => ({ ...current, search })) }} placeholder="Search expenses, vendors, projects…" /><span className="result-count">{data.count || 0} expense{data.count === 1 ? '' : 's'}</span></div>
        <div className="finance-filters finance-filters--compact">
          <Select label="Status" name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option>{['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'RECORDED'].map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select label="Funding" name="payment_source" value={filters.payment_source} onChange={updateFilter}><option value="">All funding sources</option><option value="COMPANY">Company funds</option><option value="PERSONAL">Personally paid</option></Select>
          <Select label="Currency" name="currency" value={filters.currency} onChange={updateFilter}><option value="">AFN & USD</option><option value="AFN">AFN</option><option value="USD">USD</option></Select>
          <Select label="Category" name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select label="Member" name="member" value={filters.member} onChange={updateFilter}><option value="">All members</option>{members.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</Select>
        </div>
        {loading ? <div className="panel__state"><LoadingSpinner label="Loading expenses" /></div> : error ? <ErrorState message={error} onRetry={load} /> : <><Table columns={columns} data={data.results || []} empty={<EmptyState title="No expenses yet" message="Start tracking company spending by adding the first expense." action={hasPermission('finance.expenses.create') ? <Button onClick={() => setEditor('create')}>Add expense</Button> : null} />} /><Pagination page={page} total={data.count || 0} pageSize={PAGE_SIZE} onChange={setPage} /></>}
      </section>
      <ExpenseForm open={Boolean(editor)} expense={editor === 'create' ? null : editor} members={members} categories={categories} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load() }} />
    </div>
  )
}
