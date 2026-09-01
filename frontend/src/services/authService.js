import api, { refreshAccessToken } from '../api/api'
import tokenService from './tokenService'

const authService = {
  async login(credentials) {
    const { data } = await api.post('auth/login/', credentials)
    tokenService.setTokens(data)
    return data
  },

  async refreshToken() {
    return refreshAccessToken()
  },

  async getCurrentUser() {
    const { data } = await api.get('auth/me/')
    return data
  },

  async changePassword(payload) {
    const { data } = await api.post('auth/change-password/', payload)
    return data
  },

  async logout() {
    const refresh = tokenService.getRefreshToken()
    if (!refresh) return
    await api.post('auth/logout/', { refresh })
  },
}

export default authService

