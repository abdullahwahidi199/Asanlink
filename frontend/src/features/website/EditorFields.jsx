import { Input, Select } from '../../components/ui'
import { fieldError } from '../../services/errorService'

const relatedError = (errors, name) => fieldError(errors, name) || fieldError(errors, name.replace(/_id$/, ''))

export default function EditorFields({ fields, form, setForm, errors = {}, options = {}, disabled = false, isCreate = false }) {
  const update = (event) => {
    const { name, value, type, checked, files } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files?.[0] || null : value,
    }))
  }

  return fields.map((field) => {
    const className = field.full ? 'field--full' : ''
    const required = field.required || (isCreate && field.requiredOnCreate)
    const error = relatedError(errors, field.name)
    if (field.type === 'checkbox') {
      return (
        <label className={`checkbox ${className}`.trim()} key={field.name}>
          <input type="checkbox" name={field.name} checked={Boolean(form[field.name])} onChange={update} disabled={disabled} />
          <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        </label>
      )
    }
    if (field.type === 'select') {
      const available = field.choices || options[field.optionResource] || []
      const values = field.optionFilter ? available.filter(field.optionFilter) : available
      return (
        <Select key={field.name} className={className} label={field.label} name={field.name} value={form[field.name] ?? ''} onChange={update} error={error} hint={field.hint} required={required} disabled={disabled}>
          {required && <option value="" disabled>{field.emptyLabel || `Select ${field.label.toLowerCase()}`}</option>}
          {(field.nullable || !required) && <option value="">{field.emptyLabel || 'None'}</option>}
          {values.map((option) => {
            const isTuple = Array.isArray(option)
            const value = isTuple ? option[0] : option[field.optionValue || 'id']
            const label = isTuple ? option[1] : field.optionLabel ? field.optionLabel(option) : option.name || option.title || option.label
            return <option key={value} value={value}>{label}</option>
          })}
        </Select>
      )
    }
    if (field.type === 'textarea' || field.type === 'json') {
      const id = `website-field-${field.name}`
      return (
        <div className={`field ${className}`.trim()} key={field.name}>
          <label htmlFor={id}>{field.label}</label>
          <textarea id={id} name={field.name} value={form[field.name] ?? ''} onChange={update} rows={field.rows || (field.type === 'json' ? 6 : 4)} required={required} disabled={disabled} aria-invalid={Boolean(error)} />
          {error ? <span className="field__error">{error}</span> : field.hint ? <span className="field__hint">{field.hint}</span> : null}
        </div>
      )
    }
    if (field.type === 'file') {
      return <Input key={field.name} className={className} label={field.label} name={field.name} type="file" onChange={update} error={error} hint={field.hint} required={required} disabled={disabled} accept=".png,.jpg,.jpeg,.webp,.gif,.ico,.pdf" />
    }
    return <Input key={field.name} className={className} label={field.label} name={field.name} type={field.type || 'text'} value={form[field.name] ?? ''} onChange={update} error={error} hint={field.hint} required={required} disabled={disabled} />
  })
}
