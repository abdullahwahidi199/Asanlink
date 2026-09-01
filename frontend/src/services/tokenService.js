const ACCESS_TOKEN_KEY = 'asanlink.access_token'
const REFRESH_TOKEN_KEY = 'asanlink.refresh_token'

const storage = () => window.localStorage

const tokenService = {
  getAccessToken() {
    return storage().getItem(ACCESS_TOKEN_KEY)
  },

  getRefreshToken() {
    return storage().getItem(REFRESH_TOKEN_KEY)
  },

  setTokens({ access, refresh }) {
    if (access) storage().setItem(ACCESS_TOKEN_KEY, access)
    if (refresh) storage().setItem(REFRESH_TOKEN_KEY, refresh)
  },

  clearTokens() {
    storage().removeItem(ACCESS_TOKEN_KEY)
    storage().removeItem(REFRESH_TOKEN_KEY)
  },

  hasSession() {
    return Boolean(this.getAccessToken() || this.getRefreshToken())
  },
}

export default tokenService

