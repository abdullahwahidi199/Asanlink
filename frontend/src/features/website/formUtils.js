export const initialForm = (fields, item = null) => Object.fromEntries(fields.map((field) => {
  if (field.type === 'file') return [field.name, null]
  let value = item
    ? (field.getValue ? field.getValue(item) : item[field.name])
    : field.default
  if (field.type === 'json') {
    if (value === undefined || value === null || value === '') value = field.default ?? '{}'
    else if (typeof value !== 'string') value = JSON.stringify(value, null, 2)
  }
  if (field.type === 'checkbox') value = Boolean(value)
  return [field.name, value ?? '']
}))

export const preparePayload = (fields, form) => {
  const payload = {}
  const localErrors = {}
  fields.forEach((field) => {
    const value = form[field.name]
    if (field.type === 'file') {
      if (value) payload[field.name] = value
      return
    }
    if (field.type === 'json') {
      try {
        payload[field.name] = value?.trim() ? JSON.parse(value) : field.jsonEmptyValue ?? {}
      } catch {
        localErrors[field.name] = 'Enter valid JSON.'
      }
      return
    }
    if (field.type === 'number') {
      payload[field.name] = value === '' && field.nullable ? null : Number(value || 0)
      return
    }
    if (field.optionResource) {
      if (value === '' || value === null || value === undefined) {
        if (field.required) localErrors[field.name] = `Select ${field.label.toLowerCase()}.`
        else payload[field.name] = null
        return
      }
      payload[field.name] = Number(value)
      return
    }
    payload[field.name] = value
  })
  return { payload, localErrors }
}
