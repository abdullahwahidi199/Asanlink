export const getApiError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return { message: fallback, fields: {} }

  const payload = error.response?.data?.error
  const details = payload?.details
  const fields = details && typeof details === 'object' && !Array.isArray(details) ? details : {}
  let message = payload?.message

  if (!message || message === 'The request could not be completed.') {
    const firstValue = Object.values(fields)[0]
    if (Array.isArray(firstValue)) message = String(firstValue[0])
    else if (firstValue) message = String(firstValue)
  }

  if (!message) {
    if (!error.response) message = 'The server is unavailable. Check your connection and try again.'
    else if (error.response.status >= 500) message = 'The server encountered an error. Please try again.'
    else message = fallback
  }

  return { message, fields, status: error.response?.status }
}

export const fieldError = (fields, name) => {
  const value = fields?.[name]
  return Array.isArray(value) ? String(value[0]) : value ? String(value) : ''
}

