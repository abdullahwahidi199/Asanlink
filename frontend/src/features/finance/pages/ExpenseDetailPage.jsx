import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, CheckCircle2, Clock3, Download, FileText, Pencil, Send, XCircle } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'

import { Badge, Button, ConfirmDialog, Modal, PageHeader } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import ExpenseForm from '../components/ExpenseForm'
import { FinanceError, FinanceLoading } from '../components/FinanceStates'
import { useFinanceLookups } from '../hooks'
import { formatDate, formatMoney, initials, statusTone } from '../utils'

export default function ExpenseDetailPage() {
  const { expenseId } = useParams()
  const navigate = useNavigate()
  const [expense, setExpense] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const { members, categories } = useFinanceLookups()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setExpense(await financeService.expenses.get(expenseId)) }
    catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [expenseId])
  useEffect(() => { load() }, [load])

  const transition = async (action, note = '') => {
    setActing(action)
    try {
      const updated = await financeService.expenses.transition(expense.id, action, note)
      setExpense(updated); setRejectOpen(false); setConfirmation(null); setRejectNote('')
      const titles = { submit: 'Expense submitted', approve: 'Expense approved', reject: 'Expense rejected', 'record-payment': expense.payment_source === 'PERSONAL' ? 'Expense recorded' : 'Payment recorded' }
      addToast({ type: action === 'reject' ? 'warning' : 'success', title: titles[action], message: 'The workflow timeline and finance totals are up to date.' })
    } catch (requestError) { addToast({ type: 'error', title: 'Workflow action failed', message: getApiError(requestError).message }) }
    finally { setActing('') }
  }

  if (loading) return <FinanceLoading label="Loading expense record" />
  if (error) return <FinanceError message={error} onRetry={load} />
  if (!expense) return null

  const actions = expense.allowed_actions || []
  const headerActions = <><Button variant="secondary" onClick={() => navigate('/finance/expenses')}><ArrowLeft size={16} />Back</Button>{actions.includes('edit') && <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil size={16} />Edit</Button>}{actions.includes('submit') && <Button loading={acting === 'submit'} onClick={() => transition('submit')}><Send size={16} />Submit</Button>}{actions.includes('reject') && <Button variant="danger" onClick={() => setRejectOpen(true)}><XCircle size={16} />Reject</Button>}{actions.includes('approve') && <Button onClick={() => setConfirmation('approve')}><Check size={16} />Approve</Button>}{actions.includes('record-payment') && <Button onClick={() => setConfirmation('record-payment')}><CheckCircle2 size={16} />{expense.payment_source === 'PERSONAL' ? 'Mark recorded' : 'Mark paid'}</Button>}</>

  return (
    <div className="page finance-page expense-detail">
      <PageHeader eyebrow={`Expense #${expense.id}`} title={expense.description} description={`${expense.category.name} · ${formatDate(expense.date)}`} actions={headerActions} />
      <section className="expense-hero"><div><span>Expense amount</span><strong>{formatMoney(expense.amount, expense.currency)}</strong><small>{expense.payment_source_display}</small></div><Badge tone={statusTone(expense.status)}>{expense.status_display}</Badge></section>
      <div className="expense-detail-grid">
        <div className="expense-detail-main">
          <section className="panel finance-panel"><div className="panel__header"><div><h2>Expense summary</h2><p>Payment and accounting information</p></div></div><dl className="detail-list"><Detail label="Paid by" value={<span className="detail-member"><span className="avatar avatar--small">{initials(expense.paid_by)}</span>{expense.paid_by.full_name}</span>} /><Detail label="Date" value={formatDate(expense.date)} /><Detail label="Category" value={expense.category.name} /><Detail label="Vendor" value={expense.vendor || 'Not specified'} /><Detail label="Funding source" value={expense.payment_source_display} /><Detail label="Created by" value={expense.created_by?.full_name || 'System'} /></dl></section>
          <section className="panel finance-panel"><div className="panel__header"><div><h2>Allocation</h2><p>Operational references for reporting</p></div></div><dl className="detail-list"><Detail label="Project" value={expense.project || 'Not allocated'} /><Detail label="Product" value={expense.product || 'Not allocated'} /></dl></section>
          <section className="panel finance-panel"><div className="panel__header"><div><h2>Documentation</h2><p>Receipt evidence and internal notes</p></div></div><div className="documentation-block">{expense.receipt ? <a className="receipt-document" href={expense.receipt} target="_blank" rel="noreferrer"><span><FileText size={24} /></span><div><strong>Expense receipt</strong><small>Open or download supporting documentation</small></div><Download size={18} /></a> : <div className="inline-empty"><span>◇</span><div><strong>No receipt attached</strong><p>Documentation can be added while this expense remains editable.</p></div></div>}<div className="notes-block"><span>Notes</span><p>{expense.notes || 'No additional notes were provided.'}</p></div></div></section>
        </div>
        <aside className="expense-detail-aside"><section className="panel finance-panel"><div className="panel__header"><div><h2>Approval timeline</h2><p>A permanent record of workflow decisions</p></div></div><div className="approval-timeline">{expense.events.map((event, index) => <div className={`timeline-event timeline-event--${statusTone(event.to_status)}`} key={event.id}><span className="timeline-event__dot">{index === expense.events.length - 1 ? <Clock3 size={14} /> : <Check size={14} />}</span><div><strong>{event.to_status_display}</strong><span>{formatDate(event.created_at, true)}</span><small>{event.actor?.full_name || 'System'}{event.note ? ` · ${event.note}` : ''}</small></div></div>)}</div></section><div className="audit-note"><strong>Audit-safe record</strong><p>Status changes are appended to the timeline and cannot be replaced by a manual balance.</p></div></aside>
      </div>

      <ExpenseForm open={editOpen} expense={expense} members={members} categories={categories} onClose={() => setEditOpen(false)} onSaved={(saved) => { setEditOpen(false); setExpense(saved); load() }} />
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} size="small" title="Reject expense" description="Explain what must be corrected. This note is saved in the approval timeline." footer={<><Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button><Button variant="danger" loading={acting === 'reject'} disabled={!rejectNote.trim()} onClick={() => transition('reject', rejectNote)}>Reject expense</Button></>}><div className="field"><label htmlFor="rejection-note">Rejection reason</label><textarea id="rejection-note" rows="4" value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} autoFocus /></div></Modal>
      <ConfirmDialog open={Boolean(confirmation)} onClose={() => setConfirmation(null)} onConfirm={() => transition(confirmation)} loading={Boolean(acting)} title={confirmation === 'approve' ? 'Approve this expense?' : expense.payment_source === 'PERSONAL' ? 'Record personal expense?' : 'Record company payment?'} message={confirmation === 'approve' ? 'Approval adds this expense to financial reports and member positions.' : 'This finalizes the financial event. Verify the payment before continuing.'} confirmLabel={confirmation === 'approve' ? 'Approve expense' : expense.payment_source === 'PERSONAL' ? 'Mark recorded' : 'Mark paid'} />
    </div>
  )
}

function Detail({ label, value }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
