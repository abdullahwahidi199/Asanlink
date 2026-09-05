export const currencies = ['AFN', 'USD']

export const formatMoney = (amount, currency) => {
  const value = Number(amount || 0)
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const formatDate = (value, withTime = false) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(new Date(value))
}

export const today = () => new Date().toISOString().slice(0, 10)

export const statusTone = (status) => ({
  APPROVED: 'info', PAID: 'success', RECORDED: 'success', SETTLED: 'success',
  SUBMITTED: 'warning', OUTSTANDING: 'warning', PARTIAL: 'warning', RECEIVABLE: 'success',
  REJECTED: 'danger', VOIDED: 'danger', CANCELLED: 'danger', OWES: 'danger',
}[status] || 'neutral')

export const typeTone = (type) => ({
  CONTRIBUTION: 'success', EXPENSE: 'danger', SETTLEMENT: 'info',
}[type] || 'neutral')

export const initials = (member) => member?.initials || (member?.full_name || member?.username || '?')
  .split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()

export const normalizeList = (data) => ({
  rows: data?.results || data || [],
  count: data?.count ?? data?.length ?? 0,
})
