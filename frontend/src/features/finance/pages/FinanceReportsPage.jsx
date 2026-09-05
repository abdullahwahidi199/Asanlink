import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, WalletCards } from 'lucide-react'

import PermissionGate from '../../../components/auth/PermissionGate'
import { Badge, Button, FilterToolbar, PageHeader, Select, Table } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import { CategoryBars, TrendLine } from '../components/FinanceCharts'
import { FinanceError, FinanceLoading } from '../components/FinanceStates'
import { CurrencyToggle, PanelHeader } from './FinanceOverviewPage'
import { formatMoney, initials, statusTone } from '../utils'

const initialFilters = { date_from: '', date_to: '', currency: '', project: '', product: '', group_by: 'category' }

export default function FinanceReportsPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [currency, setCurrency] = useState('AFN')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await financeService.reports(filters)) }
    catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [filters])
  useEffect(() => { load() }, [load])
  const update = (event) => { const { name, value } = event.target; setFilters((current) => ({ ...current, [name]: value })) }
  const exportReport = async (format) => {
    setExporting(format)
    try { await financeService.exportTransactions(format, filters); addToast({ type: 'success', title: 'Report downloaded', message: 'The file reflects the active report filters.' }) }
    catch (requestError) { addToast({ type: 'error', title: 'Export failed', message: getApiError(requestError).message }) }
    finally { setExporting('') }
  }

  const founderColumns = useMemo(() => [
    { key: 'member', label: 'Member', render: (row) => <div className="identity-cell"><span className="avatar avatar--table">{initials(row.member)}</span><div><strong>{row.member.full_name}</strong><span>{row.currency}</span></div></div> },
    { key: 'contributions', label: 'Contributions', render: (row) => formatMoney(row.contributions, row.currency) },
    { key: 'personal', label: 'Personal expenses', render: (row) => formatMoney(row.personal_expenses, row.currency) },
    { key: 'company', label: 'Company-funded', render: (row) => formatMoney(row.company_funded_expenses, row.currency) },
    { key: 'net', label: 'Net contribution', render: (row) => <strong>{formatMoney(row.net_contribution, row.currency)}</strong> },
    { key: 'share', label: 'Contribution share', render: (row) => `${Number(row.contribution_share).toFixed(1)}%` },
  ], [])
  const reimbursementColumns = useMemo(() => [
    { key: 'member', label: 'Member', render: (row) => row.member.full_name },
    { key: 'owed', label: 'Amount owed', render: (row) => formatMoney(row.amount_owed, row.currency) },
    { key: 'receivable', label: 'Amount receivable', render: (row) => formatMoney(row.amount_receivable, row.currency) },
    { key: 'funding', label: 'Related funding', render: (row) => formatMoney(row.net_contribution, row.currency) },
    { key: 'status', label: 'Settlement status', render: (row) => <Badge tone={statusTone(row.settlement_status)}>{row.settlement_status.toLowerCase()}</Badge> },
  ], [])

  if (loading) return <FinanceLoading label="Building financial reports" />
  if (error) return <FinanceError message={error} onRetry={load} />
  const moneyIn = Number(data.cash_flow.money_in[currency] || 0)
  const moneyOut = Number(data.cash_flow.money_out[currency] || 0)
  const net = moneyIn - moneyOut
  const groupData = data.expense_groups.filter((row) => row.currency === currency)
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => value !== initialFilters[key]).length

  return <div className="page finance-page finance-reports-page">
    <PageHeader variant="compact" title="Financial Reports" description="Understand member funding, spending trends, cash flow, and outstanding reimbursements." actions={<PermissionGate permission="finance.reports.export"><div className="split-actions"><Button variant="secondary" size="small" loading={exporting === 'csv'} onClick={() => exportReport('csv')}><Download size={15} />CSV</Button><Button size="small" loading={exporting === 'pdf'} onClick={() => exportReport('pdf')}><Download size={15} />PDF report</Button></div></PermissionGate>} />
    <FilterToolbar activeCount={activeFilterCount} columns={6} onReset={() => setFilters(initialFilters)}>
      <label className={filters.date_from ? 'filter-control--active' : ''}><span>From</span><input className="input" name="date_from" type="date" value={filters.date_from} onChange={update} /></label>
      <label className={filters.date_to ? 'filter-control--active' : ''}><span>To</span><input className="input" name="date_to" type="date" value={filters.date_to} onChange={update} /></label>
      <Select className={filters.currency ? 'filter-control--active' : ''} label="Currency" name="currency" value={filters.currency} onChange={update}><option value="">AFN &amp; USD</option><option value="AFN">AFN</option><option value="USD">USD</option></Select>
      <label className={filters.project ? 'filter-control--active' : ''}><span>Project</span><input className="input" name="project" value={filters.project} onChange={update} placeholder="All projects" /></label>
      <label className={filters.product ? 'filter-control--active' : ''}><span>Product</span><input className="input" name="product" value={filters.product} onChange={update} placeholder="All products" /></label>
      <Select className={filters.group_by !== initialFilters.group_by ? 'filter-control--active' : ''} label="Group by" name="group_by" value={filters.group_by} onChange={update}><option value="category">Category</option><option value="member">Member</option><option value="project">Project</option><option value="product">Product</option></Select>
    </FilterToolbar>
    <div className="report-heading"><h2>Company cash position</h2><CurrencyToggle value={currency} onChange={setCurrency} /></div>
    <section className="cash-flow-grid"><article className="cash-flow-card cash-flow-card--in"><span><ArrowDown size={18} /></span><div><small>Money in</small><strong>{formatMoney(moneyIn, currency)}</strong><p>Recorded contributions</p></div></article><article className="cash-flow-card cash-flow-card--out"><span><ArrowUp size={18} /></span><div><small>Money out</small><strong>{formatMoney(moneyOut, currency)}</strong><p>Company-funded expenses</p></div></article><article className="cash-flow-card cash-flow-card--net"><span><WalletCards size={18} /></span><div><small>Net cash flow</small><strong className={net < 0 ? 'money--negative' : 'money--positive'}>{formatMoney(net, currency)}</strong><p>Money in minus money out</p></div></article></section>
    <div className="finance-grid"><section className="panel finance-panel"><PanelHeader title="Monthly spending trend" text={`Recorded spending in ${currency}`} /><div className="finance-panel__body"><TrendLine data={data.monthly_spending} currency={currency} /></div></section><section className="panel finance-panel"><PanelHeader title={`Expenses by ${filters.group_by}`} text={`Current report scope · ${currency}`} /><div className="finance-panel__body"><CategoryBars data={groupData} currency={currency} /></div></section></div>
    <section className="panel finance-panel"><PanelHeader title="Founder contribution report" text="Funding composition and contribution share, never converted across currencies" /><Table columns={founderColumns} data={data.founders} /></section>
    <section className="panel finance-panel"><PanelHeader title="Outstanding reimbursement report" text="Export-ready member owed and receivable positions" /><Table columns={reimbursementColumns} data={data.reimbursements} /></section>
  </div>
}
