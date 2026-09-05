import { useEffect, useMemo, useState } from 'react'
import { FileImage, UploadCloud } from 'lucide-react'

import { Button, Input, Modal, Select } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { fieldError, getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import { today } from '../utils'

const blankExpense = {
  paid_by_id: '', amount: '', currency: 'AFN', date: today(), category_id: '',
  description: '', vendor: '', project: '', product: '', payment_source: 'COMPANY',
  notes: '', receipt: null,
}

export default function ExpenseForm({ open, expense = null, members = [], categories = [], onClose, onSaved }) {
  const [form, setForm] = useState(blankExpense)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { addToast } = useToast()
  const isEdit = Boolean(expense)
  const preview = useMemo(() => form.receipt instanceof File ? URL.createObjectURL(form.receipt) : expense?.receipt || '', [form.receipt, expense])

  useEffect(() => () => {
    if (form.receipt instanceof File && preview) URL.revokeObjectURL(preview)
  }, [form.receipt, preview])

  useEffect(() => {
    if (!open) return
    setForm(expense ? {
      paid_by_id: expense.paid_by?.id || '', amount: expense.amount || '', currency: expense.currency || 'AFN',
      date: expense.date || today(), category_id: expense.category?.id || '', description: expense.description || '',
      vendor: expense.vendor || '', project: expense.project || '', product: expense.product || '',
      payment_source: expense.payment_source || 'COMPANY', notes: expense.notes || '', receipt: null,
    } : blankExpense)
    setErrors({}); setMessage(''); setDirty(false)
  }, [open, expense])

  useEffect(() => {
    const warn = (event) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const close = () => {
    if (dirty && !saving && !window.confirm('Discard your unsaved expense changes?')) return
    onClose()
  }

  const update = (event) => {
    const { name, value, files } = event.target
    setForm((current) => ({ ...current, [name]: files ? files[0] || null : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setDirty(true)
  }

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setErrors({}); setMessage('')
    try {
      const saved = isEdit
        ? await financeService.expenses.update(expense.id, form)
        : await financeService.expenses.create(form)
      setDirty(false)
      addToast({ type: 'success', title: isEdit ? 'Expense updated' : 'Expense saved as draft', message: `${saved.currency} ${saved.amount} is ready in the expense workflow.` })
      onSaved(saved)
    } catch (requestError) {
      const parsed = getApiError(requestError, 'The expense could not be saved.')
      setErrors(parsed.fields); setMessage(parsed.message)
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={close} size="large" title={isEdit ? 'Edit expense' : 'Add company expense'} description="Record the expense once; the approval timeline and financial position update automatically." footer={<><Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" form="expense-form" loading={saving}>{isEdit ? 'Save changes' : 'Save draft'}</Button></>}>
      {message && <div className="form-alert" role="alert">{message}</div>}
      <form id="expense-form" className="finance-form" onSubmit={submit}>
        <fieldset className="finance-form__section">
          <legend><strong>Expense details</strong><span>Core amount and accounting classification</span></legend>
          <div className="form-grid">
            <Input label="Amount" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={update} error={fieldError(errors, 'amount')} required />
            <Select label="Currency" name="currency" value={form.currency} onChange={update} error={fieldError(errors, 'currency')} required><option value="AFN">AFN — Afghan afghani</option><option value="USD">USD — US dollar</option></Select>
            <Input label="Expense date" name="date" type="date" value={form.date} onChange={update} error={fieldError(errors, 'date')} required />
            <Select label="Category" name="category_id" value={form.category_id} onChange={update} error={fieldError(errors, 'category_id') || fieldError(errors, 'category')} required><option value="">Select category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            <Input className="field--full" label="Description" name="description" value={form.description} onChange={update} error={fieldError(errors, 'description')} placeholder="What was purchased and why?" maxLength={300} required />
          </div>
        </fieldset>
        <fieldset className="finance-form__section">
          <legend><strong>Payment information</strong><span>Who made the payment and where funds came from</span></legend>
          <div className="form-grid">
            <Select label="Paid by" name="paid_by_id" value={form.paid_by_id} onChange={update} error={fieldError(errors, 'paid_by_id') || fieldError(errors, 'paid_by')} required><option value="">Select member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</Select>
            <Select label="Funding source" name="payment_source" value={form.payment_source} onChange={update} error={fieldError(errors, 'payment_source')} hint={form.payment_source === 'PERSONAL' ? 'Creates a personal reimbursement position after approval.' : 'Reduces company cash after payment is recorded.'}><option value="COMPANY">Company funds</option><option value="PERSONAL">Personally paid</option></Select>
            <Input className="field--full" label="Vendor" name="vendor" value={form.vendor} onChange={update} error={fieldError(errors, 'vendor')} placeholder="Optional supplier or payee" />
          </div>
        </fieldset>
        <fieldset className="finance-form__section">
          <legend><strong>Allocation</strong><span>Optional operational references</span></legend>
          <div className="form-grid"><Input label="Project" name="project" value={form.project} onChange={update} error={fieldError(errors, 'project')} /><Input label="Product" name="product" value={form.product} onChange={update} error={fieldError(errors, 'product')} /></div>
        </fieldset>
        <fieldset className="finance-form__section">
          <legend><strong>Documentation</strong><span>Receipt evidence and internal context</span></legend>
          <div className="receipt-upload">
            <input className="sr-only" id="expense-receipt" name="receipt" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={update} />
            <label htmlFor="expense-receipt"><UploadCloud size={22} strokeWidth={1.7} /><strong>{form.receipt?.name || (expense?.receipt ? 'Replace receipt' : 'Drop or choose a receipt')}</strong><span>PDF or image, up to 10 MB</span></label>
            {preview && <a className="receipt-preview" href={preview} target="_blank" rel="noreferrer"><FileImage size={18} /><span>Preview current receipt</span></a>}
          </div>
          {fieldError(errors, 'receipt') && <span className="field__error">{fieldError(errors, 'receipt')}</span>}
          <div className="field"><label htmlFor="expense-notes">Notes</label><textarea id="expense-notes" name="notes" rows="3" value={form.notes} onChange={update} placeholder="Approval context, invoice number, or other useful detail" /><span className="field__error">{fieldError(errors, 'notes')}</span></div>
        </fieldset>
      </form>
    </Modal>
  )
}
