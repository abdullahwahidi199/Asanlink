import api from '../api/api'

const apiOrigin = (() => {
  try {
    return new URL(import.meta.env.VITE_API_URL, window.location.origin).origin
  } catch {
    return ''
  }
})()

export const resolveMediaUrl = (value) => {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${apiOrigin}${value.startsWith('/') ? value : `/${value}`}`
}

const publicWebsiteService = {
  async getProjects() {
    const { data } = await api.get('public/v1/products/')
    return data
  },
}

export default publicWebsiteService
