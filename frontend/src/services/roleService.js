import api from '../api/api'

const roleService = {
  async list(params = {}) {
    const { data } = await api.get('roles/', { params })
    return data
  },
  async get(id) {
    const { data } = await api.get(`roles/${id}/`)
    return data
  },
  async create(payload) {
    const { data } = await api.post('roles/', payload)
    return data
  },
  async update(id, payload) {
    const { data } = await api.patch(`roles/${id}/`, payload)
    return data
  },
  async remove(id) {
    await api.delete(`roles/${id}/`)
  },
  async activate(id) {
    const { data } = await api.post(`roles/${id}/activate/`)
    return data
  },
  async deactivate(id) {
    const { data } = await api.post(`roles/${id}/deactivate/`)
    return data
  },
  async getPermissions(id) {
    const { data } = await api.get(`roles/${id}/permissions/`)
    return data
  },
  async setPermissions(id, permissionIds) {
    const { data } = await api.put(`roles/${id}/permissions/`, {
      permission_ids: permissionIds,
    })
    return data
  },
}

export default roleService

