import { useEffect, useState } from 'react'
import {
  cancelTeamInvite,
  getTeam,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  type TeamInvite,
  type TeamMember,
} from '../api'
import { getAuthMeta, getUserId } from '../auth'

const ROLE_COLORS: Record<string, string> = {
  admin: '#6366f1',
  recruiter: '#10b981',
  viewer: '#f59e0b',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access — manage team, billing, all data',
  recruiter: 'Manage candidates, jobs, pipeline, interviews',
  viewer: 'Read-only access to all data',
}

export function TeamPage() {
  const meta = getAuthMeta()
  const isAdmin = meta.role === 'admin'
  const myId = getUserId()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('recruiter')
  const [busy, setBusy] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    return getTeam().then((r) => { setMembers(r.members); setInvites(r.pending_invites) }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function onInvite() {
    if (!inviteEmail) return
    setBusy(true)
    setError(null)
    setInviteLink(null)
    try {
      const r = await inviteTeamMember(inviteEmail, inviteRole)
      setInviteLink(r.invite_url)
      setInviteEmail('')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send invite.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function onRoleChange(userId: string, role: string) {
    await updateTeamMemberRole(userId, role)
    setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role } : m))
  }

  async function onRemove(userId: string, email: string) {
    if (!confirm(`Remove ${email} from the team?`)) return
    await removeTeamMember(userId)
    setMembers((prev) => prev.filter((m) => m.id !== userId))
  }

  async function onCancelInvite(id: string) {
    await cancelTeamInvite(id)
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <p className="eyebrow">Settings</p>
      <h1>Team</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>Invite recruiters and collaborators to your workspace.</p>

      {isAdmin && (
        <div className="form-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Invite a team member</h2>
            <button className="btn ghost small" onClick={() => { setShowInvite((v) => !v); setInviteLink(null); setError(null) }}>
              {showInvite ? 'Cancel' : '+ Invite'}
            </button>
          </div>
          {showInvite && (
            <div style={{ marginTop: '1rem' }}>
              <div className="grid-form">
                <label>
                  Email address
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" />
                </label>
                <label>
                  Role
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="recruiter">Recruiter</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
              </div>
              <p className="muted small" style={{ marginTop: '0.4rem' }}>{ROLE_DESCRIPTIONS[inviteRole]}</p>
              {error && <p className="muted small" style={{ color: '#f87171', marginTop: '0.5rem' }}>{error}</p>}
              <div className="actions" style={{ marginTop: '0.75rem' }}>
                <button className="btn primary" onClick={onInvite} disabled={busy || !inviteEmail}>
                  {busy ? 'Sending…' : 'Send invite'}
                </button>
              </div>
              {inviteLink && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(99,102,241,0.1)', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)' }}>
                  <p className="muted small" style={{ marginBottom: '0.35rem' }}>✓ Invite sent! Share this link if email isn't configured:</p>
                  <code style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>{inviteLink}</code>
                  <button className="btn ghost small" style={{ marginTop: '0.5rem', display: 'block' }} onClick={() => navigator.clipboard.writeText(inviteLink)}>
                    Copy link
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="form-card" style={{ marginBottom: '1.25rem' }}>
        <h2>Members ({members.length})</h2>
        {loading ? <p className="muted small">Loading…</p> : (
          <table className="team-table">
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.email}</td>
                  <td>
                    {isAdmin && m.id !== myId ? (
                      <select
                        value={m.role}
                        onChange={(e) => onRoleChange(m.id, e.target.value)}
                        style={{ color: ROLE_COLORS[m.role] ?? '#888' }}
                      >
                        <option value="admin">admin</option>
                        <option value="recruiter">recruiter</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      <span className="pill" style={{ background: (ROLE_COLORS[m.role] ?? '#888') + '22', color: ROLE_COLORS[m.role] ?? '#888' }}>{m.role}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {isAdmin && m.id !== myId && (
                      <button className="btn ghost small" style={{ color: '#f87171' }} onClick={() => onRemove(m.id, m.email)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {invites.length > 0 && (
        <div className="form-card">
          <h2>Pending invites ({invites.length})</h2>
          <table className="team-table">
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td><span className="pill" style={{ background: (ROLE_COLORS[i.role] ?? '#888') + '22', color: ROLE_COLORS[i.role] ?? '#888' }}>{i.role}</span></td>
                  <td className="muted small">expires {new Date(i.expires_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isAdmin && <button className="btn ghost small" onClick={() => onCancelInvite(i.id)}>Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
