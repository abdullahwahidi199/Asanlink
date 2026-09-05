import api from '../api/api'

const compact = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined),
)

const containsFile = (payload) => Object.values(payload).some((value) => value instanceof File)

const asFormData = (payload) => {
  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined) form.append(key, value)
  })
  return form
}

const requestPayload = (payload) => containsFile(payload)
  ? { data: asFormData(payload), config: { headers: { 'Content-Type': 'multipart/form-data' } } }
  : { data: payload, config: undefined }

const websiteService = {
  async getConfig(name) {
    const { data } = await api.get(`website/${name}/`)
    return data
  },
  async updateConfig(name, payload) {
    const prepared = requestPayload(payload)
    const { data } = await api.patch(`website/${name}/`, prepared.data, prepared.config)
    return data
  },
  async list(resource, params = {}) {
    const { data } = await api.get(`website/${resource}/`, {
      params: compact({ page_size: 250, ...params }),
    })
    return data.results || data
  },
  async create(resource, payload) {
    const prepared = requestPayload(payload)
    const { data } = await api.post(`website/${resource}/`, prepared.data, prepared.config)
    return data
  },
  async update(resource, id, payload) {
    const prepared = requestPayload(payload)
    const { data } = await api.patch(`website/${resource}/${id}/`, prepared.data, prepared.config)
    return data
  },
  async remove(resource, id) {
    await api.delete(`website/${resource}/${id}/`)
  },
  async setPublication(resource, id, action) {
    const { data } = await api.post(`website/${resource}/${id}/${action}/`)
    return data
  },
  async reorder(resource, items) {
    const { data } = await api.post(`website/${resource}/reorder/`, { items })
    return data
  },
}

export default websiteService
