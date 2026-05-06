import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHealth, login } from '../api'
import { getToken, setToken } from '../auth'

export function LoginPage() {
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
    const r = await login(password)
    setBusy(false)
    if (r.token) {
      setToken(r.token)
      navigate('/', { replace: true })
      return
    }
    setError(r.error ?? 'Login failed')
  }

  return (
    <div className="page stretch" style={{ maxWidth: 420 }}>
      <p className="eyebrow">EnPower Command</p>
      <h1>Sign in</h1>
      <p className="lede">
        Enter the <strong>admin password</strong> from the API env (<code>ADMIN_PASSWORD</code>).
        The server also needs <code>AUTH_SECRET</code> to issue tokens — that value is never typed
        here. Local dev can set <code>SKIP_AUTH=true</code> on the API to skip this screen.
      </p>
      {error && <div className="banner error">{error}</div>}
      <form className="grid-form" onSubmit={onSubmit} style={{ gridTemplateColumns: '1fr' }}>
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
    </div>
  )
}
