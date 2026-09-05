import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, Paperclip } from 'lucide-react'

import { Button, Input, Modal, Select } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { fieldError, getApiError } from '../../../services/errorService'
import financeService from '../../../services/financeService'
import { today } from '../utils'

const blankContribution = { member_id: '', amount: '', currency: 'AFN', date: today(), description: '', reference: '', notes: '', attachment: null }

export default function ContributionForm({ open, contribution = null, members = [], onClose, onSaved }) {
  const [form, setForm] = useState(blankContribution)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { addToast } = useToast()
  const preview = useMemo(() => form.attachment instanceof File ? URL.createObjectURL(form.attachment) : contribution?.attachment || '', [form.attachment, contribution])

  useEffect(() => () => {
    if (form.attachment instanceof File && preview) URL.revokeObjectURL(preview)
  }, [form.attachment, preview])

  useEffect(() => {
    if (!open) return
    setForm(contribution ? {
      member_id: contribution.member?.id || '', amount: contribution.amount, currency: contribution.currency,
      date: contribution.date, description: contribution.description, reference: contribution.reference || '',
      notes: contribution.notes || '', attachment: null,
    } : blankContribution)
    setErrors({}); setMessage(''); setDirty(false)
  }, [open, contribution])

  const update = (event) => {
    const { name, value, files } = event.target
    setForm((current) => ({ ...current, [name]: files ? files[0] || null : value }))
    setErrors((current) => ({ ...current, [name]: undefined })); setDirty(true)
  }
  const close = () => {
    if (dirty && !saving && !window.confirm('Discard your unsaved contribution changes?')) return
    onClose()
  }
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(''); setErrors({})
    try {
      const saved = contribution
        ? await financeService.contributions.update(contribution.id, form)
        : await financeService.contributions.create(form)
      setDirty(false)
      addToast({ type: 'success', title: contribution ? 'Contribution updated' : 'Contribution recorded', message: 'Member balances and contribution shares have been recalculated.' })
      onSaved(saved)
    } catch (requestError) {
      const parsed = getApiError(requestError, 'The contribution could not be saved.')
      setErrors(parsed.fields); setMessage(parsed.message)
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={close} size="large" title={contribution ? 'Edit contribution' : 'Add founder contribution'} description="This records money entering company funds. It is kept separate from company expenses." footer={<><Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" form="contribution-form" loading={saving}>{contribution ? 'Save changes' : 'Record contribution'}</Button></>}>
      <div className="contribution-callout"><span><ArrowDownToLine size={20} /></span><div><strong>Money in</strong><p>This increases company funding and the selected member’s contribution position.</p></div></div>
      {message && <div className="form-alert" role="alert">{message}</div>}
      <form id="contribution-form" className="finance-form" onSubmit={submit}>
        <fieldset className="finance-form__section"><legend><strong>Contribution details</strong><span>Member, amount, and effective date</span></legend><div className="form-grid">
          <Select label="Founder / member" name="member_id" value={form.member_id} onChange={update} error={fieldError(errors, 'member_id') || fieldError(errors, 'member')} required><option value="">Select member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</Select>
          <Input label="Date" name="date" type="date" value={form.date} onChange={update} error={fieldError(errors, 'date')} required />
          <Input label="Amount" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={update} error={fieldError(errors, 'amount')} required />
          <Select label="Currency" name="currency" value={form.currency} onChange={update} error={fieldError(errors, 'currency')} required><option value="AFN">AFN — Afghan afghani</option><option value="USD">USD — US dollar</option></Select>
          <Input className="field--full" label="Description" name="description" value={form.description} onChange={update} error={fieldError(errors, 'description')} placeholder="e.g. Initial operating capital" required />
          <Input className="field--full" label="Reference" name="reference" value={form.reference} onChange={update} error={fieldError(errors, 'reference')} placeholder="Bank transfer, receipt, or internal reference" />
        </div></fieldset>
        <fieldset className="finance-form__section"><legend><strong>Supporting documentation</strong><span>Optional proof and context</span></legend>
          <div className="receipt-upload"><input className="sr-only" id="contribution-attachment" name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={update} /><label htmlFor="contribution-attachment"><Paperclip size={20} /><strong>{form.attachment?.name || (contribution?.attachment ? 'Replace attachment' : 'Choose an attachment')}</strong><span>PDF or image, up to 10 MB</span></label>{preview && <a className="receipt-preview" href={preview} target="_blank" rel="noreferrer">Preview attachment</a>}</div>
          <div className="field"><label htmlFor="contribution-notes">Notes</label><textarea id="contribution-notes" name="notes" rows="3" value={form.notes} onChange={update} /><span className="field__error">{fieldError(errors, 'notes')}</span></div>
        </fieldset>
      </form>
    </Modal>
  )
}
