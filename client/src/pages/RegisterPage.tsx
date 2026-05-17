import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api'
import { setToken } from '../auth'

export function RegisterPage() {
  const [agencyName, setAgencyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await register({ agency_name: agencyName, email, password })
      if (r.token) {
        setToken(r.token, { tenant_name: r.tenant_name, role: r.role, plan: r.plan })
        navigate('/', { replace: true })
        return
      }
      setError(r.error ?? 'Registration failed')
    } catch {
      setError('Cannot reach API.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page stretch" style={{ maxWidth: 460 }}>
      <p className="eyebrow">RecruitCommand</p>
      <h1>Start your free trial</h1>
      <p className="lede">14 days free, no credit card required. Cancel any time.</p>
      {error && <div className="banner error">{error}</div>}
      <form className="grid-form" onSubmit={onSubmit} style={{ gridTemplateColumns: '1fr' }}>
        <label className="full">
          Agency / Company name
          <input
            type="text"
            autoComplete="organization"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Acme Recruiting"
            required
          />
        </label>
        <label className="full">
          Work email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
            required
          />
        </label>
        <label className="full">
          Password <span className="muted small">(8+ characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account — free'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', textAlign: 'center' }} className="muted small">
        Already have an account? <Link to="/login">Sign in →</Link>
      </p>
    </div>
  )
}
