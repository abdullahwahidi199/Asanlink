import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BanknoteArrowDown, Download, HandCoins, Plus, ReceiptText, Scale } from 'lucide-react'
import { Link } from 'react-router'

import PermissionGate from '../../../components/auth/PermissionGate'
import { Badge, Button, PageHeader, Table } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import ContributionForm from '../components/ContributionForm'
import ExpenseForm from '../components/ExpenseForm'
import { CategoryBars, SpendingBars } from '../components/FinanceCharts'
import { FinanceError, FinanceLoading } from '../components/FinanceStates'
import MoneyStack from '../components/MoneyStack'
import { useFinanceLookups } from '../hooks'
import { formatDate, formatMoney, initials, statusTone, typeTone } from '../utils'

const memberColumns = [
  { key: 'member', label: 'Member', render: (row) => <div className="identity-cell"><span className="avatar avatar--table">{initials(row.member)}</span><div><strong>{row.member.full_name}</strong><span>{row.currency}</span></div></div> },
  { key: 'contributions', label: 'Contributions', render: (row) => <strong className="table-money">{formatMoney(row.contributions, row.currency)}</strong> },
  { key: 'personal_expenses', label: 'Personal expenses', render: (row) => formatMoney(row.personal_expenses, row.currency) },
  { key: 'share', label: 'Share', render: (row) => `${Number(row.contribution_share).toFixed(1)}%` },
  { key: 'net_position', label: 'Net position', render: (row) => <strong className={Number(row.net_position) < 0 ? 'money--negative' : Number(row.net_position) > 0 ? 'money--positive' : ''}>{Number(row.net_position) > 0 ? '+' : ''}{formatMoney(row.net_position, row.currency)}</strong> },
  { key: 'settlement', label: 'Settlement', render: (row) => formatMoney(row.settlement_amount, row.currency) },
  { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status === 'RECEIVABLE' ? 'Should receive' : row.status === 'OWES' ? 'Owes' : 'Settled'}</Badge> },
]

export default function FinanceOverviewPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currency, setCurrency] = useState('AFN')
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [contributionOpen, setContributionOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { members, categories } = useFinanceLookups()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await financeService.dashboard()) }
    catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const exportReport = async () => {
    setExporting(true)
    try { await financeService.exportTransactions('pdf'); addToast({ type: 'success', title: 'Report exported', message: 'Your finance PDF has been downloaded.' }) }
    catch (requestError) { addToast({ type: 'error', title: 'Export failed', message: getApiError(requestError).message }) }
    finally { setExporting(false) }
  }
  const transactions = useMemo(() => data?.recent_transactions || [], [data])

  if (loading) return <FinanceLoading label="Preparing company finances" />
  if (error) return <FinanceError message={error} onRetry={load} />

  return (
    <div className="page finance-page">
      <PageHeader eyebrow="Financial command center" title="Company Finance" description="Track company expenses, contributions, settlements, and financial performance." actions={<><PermissionGate permission="finance.reports.export"><Button variant="secondary" loading={exporting} onClick={exportReport}><Download size={17} />Export report</Button></PermissionGate><PermissionGate permission="finance.contributions.create"><Button variant="secondary" onClick={() => setContributionOpen(true)}><HandCoins size={17} />Add contribution</Button></PermissionGate><PermissionGate permission="finance.expenses.create"><Button onClick={() => setExpenseOpen(true)}><Plus size={17} />Add expense</Button></PermissionGate></>} />

      <section className="finance-kpis" aria-label="Financial summary">
        <Kpi icon={HandCoins} tone="success" label="Total contributions" totals={data.summary.total_contributions} context="Money added to company funds" />
        <Kpi icon={ReceiptText} tone="danger" label="Total company expenses" totals={data.summary.total_expenses} context="Approved and recorded spend" />
        <Kpi icon={BanknoteArrowDown} tone="info" label="Personal expenses" totals={data.summary.personal_expenses} context="Paid directly by members" />
        <Kpi icon={Scale} tone="warning" label="Outstanding settlements" totals={data.summary.outstanding_settlements} context="Recommended member transfers" />
      </section>

      <div className="finance-grid finance-grid--dashboard">
        <section className="panel finance-panel finance-panel--chart"><PanelHeader title="Monthly spending" text="Recorded spend over time" action={<CurrencyToggle value={currency} onChange={setCurrency} />} /><div className="finance-panel__body"><SpendingBars data={data.monthly_spending} currency={currency} /></div></section>
        <section className="panel finance-panel"><PanelHeader title="Settlement center" text="The clearest path to balanced member positions" action={<Link className="text-link" to="/finance/settlements">View all <ArrowRight size={14} /></Link>} /><div className="settlement-preview-list">{data.settlements.slice(0, 3).map((item) => <article className="settlement-preview" key={item.id}><div className="settlement-route"><span className="avatar avatar--small">{initials(item.payer)}</span><strong>{item.payer.full_name}</strong><ArrowRight size={15} /><strong>{item.receiver.full_name}</strong></div><div><strong>{formatMoney(item.amount, item.currency)}</strong><Badge tone="warning">Required</Badge></div></article>)}{!data.settlements.length && <div className="inline-empty"><span>✓</span><div><strong>Everyone is settled</strong><p>No member transfers are currently required.</p></div></div>}</div></section>
      </div>

      <section className="panel finance-panel"><PanelHeader title="Founder financial overview" text="Funding, personal spend, and settlement position by currency" /><Table columns={memberColumns} data={data.founders} empty={<div className="inline-empty inline-empty--center"><span>◎</span><div><strong>No member positions yet</strong><p>Add a contribution or approved personal expense to begin.</p></div></div>} /><div className="method-note">{data.methodology}</div></section>

      <div className="finance-grid">
        <section className="panel finance-panel"><PanelHeader title="Biggest expense categories" text={`Category distribution in ${currency}`} /><div className="finance-panel__body"><CategoryBars data={data.category_spending} currency={currency} /></div></section>
        <section className="panel finance-panel"><PanelHeader title="Recent transactions" text="Latest activity across the ledger" action={<Link className="text-link" to="/finance/transactions">Open ledger <ArrowRight size={14} /></Link>} /><div className="recent-list">{transactions.map((item) => <div className="recent-row" key={item.id}><span className={`transaction-mark transaction-mark--${item.type.toLowerCase()}`}><ReceiptText size={16} /></span><div><strong>{item.description}</strong><span>{item.member.full_name} · {formatDate(item.date)}</span></div><div><strong>{formatMoney(item.amount, item.currency)}</strong><Badge tone={typeTone(item.type)}>{item.type.toLowerCase()}</Badge></div></div>)}{!transactions.length && <div className="inline-empty inline-empty--center"><span>◇</span><div><strong>No transactions yet</strong><p>Your ledger activity will appear here.</p></div></div>}</div></section>
      </div>

      <ExpenseForm open={expenseOpen} members={members} categories={categories} onClose={() => setExpenseOpen(false)} onSaved={() => { setExpenseOpen(false); load() }} />
      <ContributionForm open={contributionOpen} members={members} onClose={() => setContributionOpen(false)} onSaved={() => { setContributionOpen(false); load() }} />
    </div>
  )
}

function Kpi({ icon: KpiIcon, tone, label, totals, context }) {
  return <article className={`finance-kpi finance-kpi--${tone}`}><div className="finance-kpi__top"><span className="finance-kpi__icon"><KpiIcon size={19} /></span><span>{label}</span></div><MoneyStack totals={totals} /><small>{context}</small></article>
}

export function PanelHeader({ title, text, action }) {
  return <div className="panel__header"><div><h2>{title}</h2>{text && <p>{text}</p>}</div>{action}</div>
}

export function CurrencyToggle({ value, onChange }) {
  return <div className="currency-toggle" role="group" aria-label="Currency">{['AFN', 'USD'].map((item) => <button key={item} type="button" className={value === item ? 'is-active' : ''} onClick={() => onChange(item)}>{item}</button>)}</div>
}
