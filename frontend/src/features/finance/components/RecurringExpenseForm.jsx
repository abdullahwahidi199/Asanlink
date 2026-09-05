import { useEffect, useState } from 'react'

import { Button, Input, Modal, Select } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { fieldError, getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import { today } from '../utils'

const blankRule = {
  name: '', amount: '', currency: 'AFN', category_id: '', vendor: '', frequency: 'MONTHLY',
  start_date: today(), end_date: '', next_occurrence: today(), project: '', product: '',
  paid_by_id: '', payment_source: 'COMPANY', notes: '', is_active: true,
}

export default function RecurringExpenseForm({ open, rule = null, members = [], categories = [], onClose, onSaved }) {
  const [form, setForm] = useState(blankRule)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()
  useEffect(() => {
    if (!open) return
    setForm(rule ? {
      name: rule.name, amount: rule.amount, currency: rule.currency, category_id: rule.category?.id || '',
      vendor: rule.vendor || '', frequency: rule.frequency, start_date: rule.start_date, end_date: rule.end_date || '',
      next_occurrence: rule.next_occurrence, project: rule.project || '', product: rule.product || '',
      paid_by_id: rule.paid_by?.id || '', payment_source: rule.payment_source, notes: rule.notes || '', is_active: rule.is_active,
    } : blankRule)
    setErrors({}); setMessage('')
  }, [open, rule])
  const update = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : value }
      if (name === 'start_date' && !rule) next.next_occurrence = value
      return next
    })
    setErrors((current) => ({ ...current, [name]: undefined }))
  }
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setErrors({}); setMessage('')
    try {
      const payload = { ...form, end_date: form.end_date || null }
      const saved = rule ? await financeService.recurring.update(rule.id, payload) : await financeService.recurring.create(payload)
      addToast({ type: 'success', title: rule ? 'Schedule updated' : 'Recurring expense created', message: `Next occurrence: ${saved.next_occurrence}.` })
      onSaved(saved)
    } catch (requestError) { const parsed = getApiError(requestError, 'The recurring expense could not be saved.'); setErrors(parsed.fields); setMessage(parsed.message) }
    finally { setSaving(false) }
  }
  return <Modal open={open} onClose={onClose} size="large" title={rule ? 'Edit recurring expense' : 'Add recurring expense'} description="Create predictable draft expenses without duplicating an occurrence." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="recurring-form" loading={saving}>{rule ? 'Save schedule' : 'Create schedule'}</Button></>}>
    {message && <div className="form-alert" role="alert">{message}</div>}
    <form id="recurring-form" className="finance-form" onSubmit={submit}><fieldset className="finance-form__section"><legend><strong>Schedule details</strong><span>What repeats, how often, and for how long</span></legend><div className="form-grid">
      <Input className="field--full" label="Name" name="name" value={form.name} onChange={update} error={fieldError(errors, 'name')} placeholder="e.g. Production hosting" required />
      <Input label="Amount" name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={update} error={fieldError(errors, 'amount')} required />
      <Select label="Currency" name="currency" value={form.currency} onChange={update} error={fieldError(errors, 'currency')}><option value="AFN">AFN</option><option value="USD">USD</option></Select>
      <Select label="Frequency" name="frequency" value={form.frequency} onChange={update} error={fieldError(errors, 'frequency')}><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option></Select>
      <Select label="Category" name="category_id" value={form.category_id} onChange={update} error={fieldError(errors, 'category_id') || fieldError(errors, 'category')} required><option value="">Select category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Input label="Start date" name="start_date" type="date" value={form.start_date} onChange={update} error={fieldError(errors, 'start_date')} required />
      <Input label="End date" name="end_date" type="date" value={form.end_date} onChange={update} error={fieldError(errors, 'end_date')} min={form.start_date} />
      <Input label="Next occurrence" name="next_occurrence" type="date" value={form.next_occurrence} onChange={update} error={fieldError(errors, 'next_occurrence')} min={form.start_date} required />
    </div></fieldset><fieldset className="finance-form__section"><legend><strong>Payment &amp; allocation</strong><span>Defaults copied into every generated draft</span></legend><div className="form-grid">
      <Select label="Paid by" name="paid_by_id" value={form.paid_by_id} onChange={update} error={fieldError(errors, 'paid_by_id') || fieldError(errors, 'paid_by')} required><option value="">Select member</option>{members.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</Select>
      <Select label="Funding source" name="payment_source" value={form.payment_source} onChange={update} error={fieldError(errors, 'payment_source')}><option value="COMPANY">Company funds</option><option value="PERSONAL">Personally paid</option></Select>
      <Input className="field--full" label="Vendor" name="vendor" value={form.vendor} onChange={update} error={fieldError(errors, 'vendor')} />
      <Input label="Project" name="project" value={form.project} onChange={update} error={fieldError(errors, 'project')} /><Input label="Product" name="product" value={form.product} onChange={update} error={fieldError(errors, 'product')} />
      <div className="field field--full"><label htmlFor="recurring-notes">Notes</label><textarea id="recurring-notes" name="notes" rows="3" value={form.notes} onChange={update} /></div>
      <label className="checkbox field--full"><input name="is_active" type="checkbox" checked={form.is_active} onChange={update} /><span><strong>Active schedule</strong><small>Active rules can generate due draft expenses.</small></span></label>
    </div></fieldset></form>
  </Modal>
}
