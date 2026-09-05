import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'

import ThemeToggle from '../components/ThemeToggle'
import { Button, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getApiError } from '../services/errorService'

export default function LoginPage() {
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, isAuthenticated, isLoading } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('session') === 'expired') {
      setError('Your session expired. Please sign in again.')
    }
    if (searchParams.get('password') === 'changed') {
      setError('Your password was changed. Sign in again with the new password.')
    }
  }, [searchParams])

  if (!isLoading && isAuthenticated) return <Navigate to="/manage" replace />

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.identifier.trim() || !form.password) {
      setError('Enter your email or username and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login({ identifier: form.identifier.trim(), password: form.password })
      addToast({ type: 'success', title: 'Welcome back', message: 'You are signed in to Asanlink Central.' })
      const stateDestination = location.state?.from?.pathname
      const queryDestination = searchParams.get('from')
      const destination = stateDestination || (queryDestination?.startsWith('/') ? queryDestination : '/manage')
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError, 'Unable to sign in with those credentials.').message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="Asanlink Central">
        <div className="login-brand-panel__content">
          <div className="brand brand--login"><div className="brand__mark">A</div><div><strong>Asanlink</strong><span>Central System</span></div></div>
          <div className="login-brand-panel__message">
            <span className="eyebrow">One secure workspace</span>
            <h1>Company access, built for what comes next.</h1>
            <p>A secure foundation for Asanlink teams, products, and connected systems.</p>
          </div>
          <p className="login-brand-panel__footer">Authentication and access are centrally managed.</p>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form-panel__theme"><ThemeToggle /></div>
        <div className="login-card">
          <div className="login-card__mobile-brand"><div className="brand__mark">A</div><strong>Asanlink Central</strong></div>
          <span className="eyebrow">Secure sign in</span>
          <h2>Welcome back</h2>
          <p>Use your company username or email address.</p>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <form onSubmit={submit} noValidate>
            <Input
              label="Email or username"
              name="identifier"
              type="text"
              value={form.identifier}
              onChange={update}
              autoComplete="username"
              autoFocus
              required
              placeholder="you@asanlink.com"
            />
            <div className="password-field">
              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={update}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={`${showPassword ? 'Hide' : 'Show'} password`}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <Button type="submit" loading={loading} className="login-submit">Sign in</Button>
          </form>
          <p className="login-help">Contact your Asanlink administrator if you cannot access your account.</p>
        </div>
      </section>
    </main>
  )
}
