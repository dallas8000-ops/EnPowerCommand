import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { acceptInvite, getInviteDetails } from '../api'
import { setToken } from '../auth'

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<{ email: string; role: string; tenant_name: string } | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) return
    getInviteDetails(token)
      .then(setInvite)
      .catch(() => setNotFound(true))
  }, [token])

  async function onAccept() {
    if (!token || !invite) return
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setBusy(true)
    setError(null)
    try {
      const r = await acceptInvite(token, name, password)
      setToken(r.token, { tenant_name: invite.tenant_name, role: r.role })
      navigate('/')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to accept invite.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (notFound) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Invite not found</h1>
          <p className="muted">This invite link is invalid or has expired. Ask your admin to send a new one.</p>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="muted">Loading invite…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">RecruitCommand</p>
        <h1>Join {invite.tenant_name}</h1>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          You've been invited as a <strong>{invite.role}</strong>. Set up your account to get started.
        </p>
        <label>
          Email
          <input type="email" value={invite.email} disabled />
        </label>
        <label style={{ marginTop: '0.75rem' }}>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
        </label>
        <label style={{ marginTop: '0.75rem' }}>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
        </label>
        <label style={{ marginTop: '0.75rem' }}>
          Confirm password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p style={{ color: '#f87171', fontSize: '0.88rem', marginTop: '0.5rem' }}>{error}</p>}
        <button
          className="btn primary"
          style={{ width: '100%', marginTop: '1.25rem' }}
          onClick={onAccept}
          disabled={busy || !name || !password || !confirm}
        >
          {busy ? 'Setting up account…' : 'Create account & join'}
        </button>
      </div>
    </div>
  )
}
