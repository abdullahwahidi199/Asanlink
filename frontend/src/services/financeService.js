import api from '../api/api'

const compactParams = (params = {}) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
)

const asFormData = (payload) => {
  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined) form.append(key, value)
  })
  return form
}

const download = async (format, params = {}) => {
  const response = await api.get('finance/transactions/export/', {
    params: compactParams({ ...params, export_format: format }),
    responseType: 'blob',
  })
  const disposition = response.headers['content-disposition'] || ''
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `finance-report.${format}`
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const financeService = {
  async dashboard(params = {}) {
    const { data } = await api.get('finance/dashboard/', { params: compactParams(params) })
    return data
  },
  async transactions(params = {}) {
    const { data } = await api.get('finance/transactions/', { params: compactParams(params) })
    return data
  },
  async reports(params = {}) {
    const { data } = await api.get('finance/reports/', { params: compactParams(params) })
    return data
  },
  async members() {
    const { data } = await api.get('finance/members/')
    return data
  },
  async categories() {
    const { data } = await api.get('finance/categories/', { params: { page_size: 250 } })
    return data.results || data
  },
  expenses: {
    async list(params = {}) {
      const { data } = await api.get('finance/expenses/', { params: compactParams(params) })
      return data
    },
    async get(id) {
      const { data } = await api.get(`finance/expenses/${id}/`)
      return data
    },
    async create(payload) {
      const { data } = await api.post('finance/expenses/', asFormData(payload), { headers: { 'Content-Type': 'multipart/form-data' } })
      return data
    },
    async update(id, payload) {
      const { data } = await api.patch(`finance/expenses/${id}/`, asFormData(payload), { headers: { 'Content-Type': 'multipart/form-data' } })
      return data
    },
    async transition(id, action, note = '') {
      const { data } = await api.post(`finance/expenses/${id}/${action}/`, { note })
      return data
    },
  },
  contributions: {
    async list(params = {}) {
      const { data } = await api.get('finance/contributions/', { params: compactParams(params) })
      return data
    },
    async create(payload) {
      const { data } = await api.post('finance/contributions/', asFormData(payload), { headers: { 'Content-Type': 'multipart/form-data' } })
      return data
    },
    async update(id, payload) {
      const { data } = await api.patch(`finance/contributions/${id}/`, asFormData(payload), { headers: { 'Content-Type': 'multipart/form-data' } })
      return data
    },
    async void(id) {
      const { data } = await api.post(`finance/contributions/${id}/void/`)
      return data
    },
  },
  settlements: {
    async list(params = {}) {
      const { data } = await api.get('finance/settlements/', { params: compactParams(params) })
      return data
    },
    async recommendations(params = {}) {
      const { data } = await api.get('finance/settlements/recommendations/', { params: compactParams(params) })
      return data
    },
    async create(payload) {
      const { data } = await api.post('finance/settlements/', payload)
      return data
    },
    async record(payload) {
      const { data } = await api.post('finance/settlements/record/', payload)
      return data
    },
    async markPaid(id, amount) {
      const { data } = await api.post(`finance/settlements/${id}/mark-paid/`, { amount })
      return data
    },
  },
  recurring: {
    async list(params = {}) {
      const { data } = await api.get('finance/recurring-expenses/', { params: compactParams(params) })
      return data
    },
    async create(payload) {
      const { data } = await api.post('finance/recurring-expenses/', payload)
      return data
    },
    async update(id, payload) {
      const { data } = await api.patch(`finance/recurring-expenses/${id}/`, payload)
      return data
    },
    async toggle(id, active) {
      const { data } = await api.post(`finance/recurring-expenses/${id}/${active ? 'resume' : 'pause'}/`)
      return data
    },
    async generate(id, throughDate) {
      const { data } = await api.post(`finance/recurring-expenses/${id}/generate/`, { through_date: throughDate })
      return data
    },
  },
  exportTransactions: download,
}

export default financeService
