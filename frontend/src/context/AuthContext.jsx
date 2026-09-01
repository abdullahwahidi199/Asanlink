import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import authService from '../services/authService'
import tokenService from '../services/tokenService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const booted = useRef(false)

  const refreshUser = useCallback(async () => {
    const currentUser = await authService.getCurrentUser()
    setUser(currentUser)
    return currentUser
  }, [])

  useEffect(() => {
    if (booted.current) return
    booted.current = true

    const bootstrap = async () => {
      if (!tokenService.hasSession()) {
        setIsLoading(false)
        return
      }
      try {
        await refreshUser()
      } catch {
        tokenService.clearTokens()
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
  }, [refreshUser])

  useEffect(() => {
    const handleExpired = () => setUser(null)
    window.addEventListener('auth:session-expired', handleExpired)
    return () => window.removeEventListener('auth:session-expired', handleExpired)
  }, [])

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      tokenService.clearTokens()
      setUser(null)
    }
  }, [])

  const changePassword = useCallback(async (payload) => {
    const result = await authService.changePassword(payload)
    tokenService.clearTokens()
    setUser(null)
    return result
  }, [])

  const hasPermission = useCallback(
    (permission) => {
      if (!permission) return true
      const required = Array.isArray(permission) ? permission : [permission]
      return required.every((codename) => user?.permissions?.includes(codename))
    },
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      changePassword,
      refreshUser,
      hasPermission,
    }),
    [user, isLoading, login, logout, changePassword, refreshUser, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider.')
  return value
}

