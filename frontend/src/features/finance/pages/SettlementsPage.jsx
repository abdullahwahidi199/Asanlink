import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Info, Scale } from 'lucide-react'

import PermissionGate from '../../../components/auth/PermissionGate'
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, LoadingSpinner, PageHeader, Select, Table } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import { formatDate, formatMoney, initials, statusTone, today } from '../utils'

export default function SettlementsPage() {
  const [dashboard, setDashboard] = useState(null)
  const [history, setHistory] = useState([])
  const [currency, setCurrency] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null)
  const [acting, setActing] = useState(false)
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [summary, settlements] = await Promise.all([
        financeService.dashboard({ currency }),
        financeService.settlements.list({ currency, page_size: 100 }),
      ])
      setDashboard(summary); setHistory(settlements.results || settlements)
    } catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [currency])
  useEffect(() => { load() }, [load])

  const recordSettlement = async () => {
    setActing(true)
    try {
      await financeService.settlements.record({ payer_id: target.payer.id, receiver_id: target.receiver.id, amount: target.amount, currency: target.currency, date: today(), reason: target.reason })
      addToast({ type: 'success', title: 'Settlement recorded', message: `${target.payer.full_name} → ${target.receiver.full_name} is reflected in member positions.` })
      setTarget(null); load()
    } catch (requestError) { addToast({ type: 'error', title: 'Settlement failed', message: getApiError(requestError).message }) }
    finally { setActing(false) }
  }

  const historyColumns = useMemo(() => [
    { key: 'route', label: 'Settlement', render: (row) => <div className="settlement-table-route"><span className="avatar avatar--small">{initials(row.payer)}</span><strong>{row.payer.full_name}</strong><ArrowRight size={14} /><strong>{row.receiver.full_name}</strong></div> },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    { key: 'amount', label: 'Amount', render: (row) => <strong className="table-money">{formatMoney(row.amount, row.currency)}</strong> },
    { key: 'paid', label: 'Settled', render: (row) => formatMoney(row.settled_amount, row.currency) },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status_display}</Badge> },
    { key: 'reason', label: 'Reason', render: (row) => row.reason || 'Member balance settlement' },
  ], [])

  if (loading) return <div className="panel__state"><LoadingSpinner label="Calculating settlements" /></div>
  if (error) return <ErrorState message={error} onRetry={load} />
  const recommendations = dashboard?.settlements || []
  const balances = (dashboard?.founders || []).filter((row) => row.status !== 'SETTLED')

  return (
    <div className="page finance-page">
      <PageHeader eyebrow="Member balancing" title="Settlements" description="See who owes whom and record transfers without doing accounting math manually." actions={<Select className="header-select" aria-label="Settlement currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="">AFN &amp; USD</option><option value="AFN">AFN</option><option value="USD">USD</option></Select>} />
      <div className="settlement-method"><Info size={18} /><p>{dashboard.methodology}</p></div>
      <section className="settlement-recommendations">
        <div className="section-heading"><div><span className="eyebrow">Recommended transfers</span><h2>{recommendations.length ? 'Settlement required' : 'All positions balanced'}</h2></div><Badge tone={recommendations.length ? 'warning' : 'success'}>{recommendations.length} outstanding</Badge></div>
        <div className="settlement-card-grid">
          {recommendations.map((item) => <article className="settlement-card" key={item.id}><div className="settlement-card__top"><span className="settlement-card__icon"><Scale size={19} /></span><Badge tone="warning">Settlement required</Badge></div><div className="settlement-card__route"><div><span className="avatar">{initials(item.payer)}</span><small>Payer</small><strong>{item.payer.full_name}</strong></div><span className="settlement-arrow"><ArrowRight size={20} /></span><div><span className="avatar">{initials(item.receiver)}</span><small>Receiver</small><strong>{item.receiver.full_name}</strong></div></div><strong className="settlement-card__amount">{formatMoney(item.amount, item.currency)}</strong><p>{item.reason}</p><PermissionGate permission="finance.settlements.settle"><Button onClick={() => setTarget(item)}><CheckCircle2 size={16} />Mark as settled</Button></PermissionGate></article>)}
          {!recommendations.length && <div className="settled-empty"><span><CheckCircle2 size={26} /></span><div><strong>No transfer is required</strong><p>Recorded member funding is currently balanced in every active currency.</p></div></div>}
        </div>
      </section>
      {balances.length > 0 && <section className="position-strip">{balances.map((row) => <article key={`${row.member.id}-${row.currency}`}><span className="avatar avatar--small">{initials(row.member)}</span><div><strong>{row.member.full_name}</strong><small>{row.status === 'OWES' ? 'Amount owed' : 'Amount receivable'}</small></div><strong className={row.status === 'OWES' ? 'money--negative' : 'money--positive'}>{formatMoney(row.settlement_amount, row.currency)}</strong></article>)}</section>}
      <section className="panel finance-panel"><div className="panel__header"><div><h2>Settlement history</h2><p>Outstanding, partial, and completed member transfers</p></div></div><Table columns={historyColumns} data={history} empty={<EmptyState title="No settlements recorded" message="Completed and manually tracked transfers will appear here." />} /></section>
      <ConfirmDialog open={Boolean(target)} onClose={() => setTarget(null)} onConfirm={recordSettlement} loading={acting} title="Confirm member settlement" message={target ? `Confirm that ${target.payer.full_name} paid ${target.receiver.full_name} ${formatMoney(target.amount, target.currency)}. This changes both member positions.` : ''} confirmLabel="Record settlement" />
    </div>
  )
}
