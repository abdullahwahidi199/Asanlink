import api from '../api/api'

const userService = {
  async list(params = {}) {
    const { data } = await api.get('users/', { params })
    return data
  },
  async get(id) {
    const { data } = await api.get(`users/${id}/`)
    return data
  },
  async create(payload) {
    const { data } = await api.post('users/', payload)
    return data
  },
  async update(id, payload) {
    const { data } = await api.patch(`users/${id}/`, payload)
    return data
  },
  async remove(id) {
    await api.delete(`users/${id}/`)
  },
  async activate(id) {
    const { data } = await api.post(`users/${id}/activate/`)
    return data
  },
  async deactivate(id) {
    const { data } = await api.post(`users/${id}/deactivate/`)
    return data
  },
  async setRole(id, roleId) {
    const { data } = await api.post(`users/${id}/set-role/`, { role_id: roleId })
    return data
  },
  async resetPassword(id, payload) {
    const { data } = await api.post(`users/${id}/reset-password/`, payload)
    return data
  },
}

export default userService

