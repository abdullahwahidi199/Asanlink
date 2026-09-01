import api from '../api/api'

const permissionService = {
  async list(params = {}) {
    const { data } = await api.get('permissions/', { params })
    return data
  },
  async get(id) {
    const { data } = await api.get(`permissions/${id}/`)
    return data
  },
}

export default permissionService

