import { useState } from 'react'
import { clientLogin, getClientJobCandidates, getClientJobs, type ClientJob } from '../api'

const CLIENT_TOKEN_KEY = 'enpower_client_token'
const CLIENT_NAME_KEY = 'enpower_client_name'
type ClientCandidate = {
  id: string; name: string; title: string | null; location: string | null
  skills: string | null; stage: string; notes: string | null; submitted_at: string
}

export function ClientPortalPage() {
  const [token, setToken] = useState(() => localStorage.getItem(CLIENT_TOKEN_KEY) ?? '')
  const [clientName, setClientName] = useState(() => localStorage.getItem(CLIENT_NAME_KEY) ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [jobs, setJobs] = useState<ClientJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [selectedJob, setSelectedJob] = useState<ClientJob | null>(null)
  const [candidates, setCandidates] = useState<ClientCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  async function onLogin() {
    setLoginBusy(true); setLoginError(null)
    try {
      const r = await clientLogin(email, password)
      localStorage.setItem(CLIENT_TOKEN_KEY, r.token)
      localStorage.setItem(CLIENT_NAME_KEY, r.name)
      setToken(r.token); setClientName(r.name)
      await loadJobs(r.token)
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : 'Login failed')
    } finally { setLoginBusy(false) }
  }

  async function loadJobs(t: string) {
    setLoadingJobs(true)
    try {
      const r = await getClientJobs(t)
      setJobs(r.jobs)
    } finally { setLoadingJobs(false) }
  }

  async function onSelectJob(job: ClientJob) {
    setSelectedJob(job); setCandidates([]); setLoadingCandidates(true)
    try {
      const r = await getClientJobCandidates(token, job.id)
      setCandidates(r.candidates as ClientCandidate[])
    } finally { setLoadingCandidates(false) }
  }

  function onLogout() {
    localStorage.removeItem(CLIENT_TOKEN_KEY); localStorage.removeItem(CLIENT_NAME_KEY)
    setToken(''); setClientName(''); setJobs([]); setSelectedJob(null)
  }

  if (!token) {
    return (
      <div className="page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: '4rem' }}>
        <p className="eyebrow">Client Access</p>
        <h1 style={{ marginBottom: '1.5rem' }}>Client Portal</h1>
        {loginError && <div className="banner error" style={{ marginBottom: '0.75rem' }}>{loginError}</div>}
        <div className="form-card">
          <div className="grid-form">
            <label className="full">
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@company.com" onKeyDown={(e) => e.key === 'Enter' && onLogin()} />
            </label>
            <label className="full">
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onLogin()} />
            </label>
          </div>
          <div className="actions" style={{ marginTop: '1rem' }}>
            <button className="btn primary" onClick={onLogin} disabled={loginBusy || !email || !password}>
              {loginBusy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: '1rem', textAlign: 'center' }}>
          Need access? Contact your recruiter to get an account.
        </p>
      </div>
    )
  }

  if (selectedJob) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <button className="btn ghost small" onClick={() => setSelectedJob(null)} style={{ marginBottom: '0.5rem' }}>← Back to jobs</button>
            <h1>{selectedJob.title}</h1>
            <p className="muted">{selectedJob.client_company}{selectedJob.location ? ` · ${selectedJob.location}` : ''}</p>
          </div>
        </div>
        <p className="muted small" style={{ marginBottom: '1rem' }}>
          {selectedJob.candidate_count} candidate{selectedJob.candidate_count !== 1 ? 's' : ''} submitted · {selectedJob.application_count} application{selectedJob.application_count !== 1 ? 's' : ''}
        </p>
        {loadingCandidates && <p className="muted">Loading candidates…</p>}
        {!loadingCandidates && candidates.length === 0 && <p className="muted">No candidates submitted yet. Check back soon.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {candidates.map((c) => (
            <div key={c.id} className="form-card" style={{ padding: '0.85rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{c.name}</p>
                  {c.title && <p className="muted small">{c.title}{c.location ? ` · ${c.location}` : ''}</p>}
                  {c.skills && <p className="muted small" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>{c.skills}</p>}
                </div>
                <span style={{ padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, background: '#6366f122', color: '#6366f1' }}>{c.stage}</span>
              </div>
              {c.notes && <p className="muted small" style={{ marginTop: '0.4rem', fontStyle: 'italic' }}>{c.notes}</p>}
              <p className="muted small" style={{ marginTop: '0.3rem' }}>Submitted {new Date(c.submitted_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Client Portal</p>
          <h1>Welcome, {clientName}</h1>
        </div>
        <button className="btn ghost" onClick={onLogout}>Sign out</button>
      </div>
      {loadingJobs && <p className="muted">Loading your jobs…</p>}
      {!loadingJobs && jobs.length === 0 && <p className="muted">No job orders found. Contact your recruiter.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        {jobs.map((j) => (
          <div key={j.id} className="form-card" style={{ padding: '0.85rem 1rem', cursor: 'pointer' }} onClick={() => onSelectJob(j)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600 }}>{j.title}</p>
                <p className="muted small">{j.client_company}{j.location ? ` · ${j.location}` : ''}{j.remote ? ' · Remote' : ''}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 600, color: '#6366f1' }}>{j.candidate_count} candidate{j.candidate_count !== 1 ? 's' : ''}</p>
                <p className="muted small">{j.application_count} application{j.application_count !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <p className="muted small" style={{ marginTop: '0.3rem' }}>
              <span style={{ color: j.status === 'open' ? '#22c55e' : '#888', fontWeight: 600 }}>{j.status}</span> · Opened {new Date(j.opened_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
