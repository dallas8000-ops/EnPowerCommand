import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getHealth, login } from '../api'
import { getAuthMeta, getToken, setToken } from '../auth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getHealth().then((h) => {
      if (!h.auth_required || getToken()) navigate('/', { replace: true })
    })
  }, [navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await login(email, password)
      if (r.token) {
        setToken(r.token, { tenant_name: r.tenant_name, role: r.role })
        navigate('/', { replace: true })
        return
      }
      setError(r.error ?? 'Login failed')
    } catch {
      setError('Cannot reach API. Check VITE_API_URL, CORS_ORIGIN, and API deploy status.')
    } finally {
      setBusy(false)
    }
  }

  const meta = getAuthMeta()

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">RecruitCommand</p>
        <h1>Sign in</h1>
        {meta.tenant_name && (
          <p className="lede">Welcome back, <strong>{meta.tenant_name}</strong></p>
        )}
        {error && <div className="banner error">{error}</div>}
        <form className="grid-form" onSubmit={onSubmit} style={{ gridTemplateColumns: '1fr' }}>
          <label className="full">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="full">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }} className="muted small">
          No account? <Link to="/register">Create one free →</Link>
        </p>
      </div>
    </div>
  )
}
