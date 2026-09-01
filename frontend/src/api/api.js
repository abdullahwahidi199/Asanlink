import axios from 'axios'

import tokenService from '../services/tokenService'

if (!import.meta.env.VITE_API_URL) {
  throw new Error('VITE_API_URL is required. Copy .env.example to .env.')
}

const jsonConfig = {
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
}

const api = axios.create(jsonConfig)
const refreshClient = axios.create(jsonConfig)

let refreshPromise = null
let sessionExpiryNotified = false

const notify = (name, detail) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  }
}

const expireSession = () => {
  tokenService.clearTokens()
  const shouldNotify = !sessionExpiryNotified
  if (shouldNotify) {
    sessionExpiryNotified = true
    notify('auth:session-expired')
  }

  if (shouldNotify && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    const returnTo = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/login?session=expired&from=${encodeURIComponent(returnTo)}`)
  }
}

export const refreshAccessToken = async () => {
  const refresh = tokenService.getRefreshToken()
  if (!refresh) throw new Error('No refresh token is available.')

  const { data } = await refreshClient.post('auth/refresh/', { refresh })
  tokenService.setTokens({
    access: data.access,
    refresh: data.refresh || refresh,
  })
  sessionExpiryNotified = false
  return data.access
}

api.interceptors.request.use((config) => {
  const access = tokenService.getAccessToken()
  if (access) {
    config.headers.Authorization = `Bearer ${access}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest = error.config || {}
    const url = String(originalRequest.url || '')

    if (status === 403) {
      notify('api:forbidden', {
        message:
          error.response?.data?.error?.message ||
          'You do not have permission to perform that action.',
      })
      return Promise.reject(error)
    }

    const isCredentialEndpoint =
      url.includes('auth/login/') || url.includes('auth/refresh/')

    if (
      status !== 401 ||
      originalRequest._retry ||
      isCredentialEndpoint ||
      !tokenService.getRefreshToken()
    ) {
      if (status === 401 && !isCredentialEndpoint) expireSession()
      return Promise.reject(error)
    }

    originalRequest._retry = true
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const access = await refreshPromise
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${access}`
      return api(originalRequest)
    } catch (refreshError) {
      expireSession()
      return Promise.reject(refreshError)
    }
  },
)

export default api
