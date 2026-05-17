import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApplications, listJobOrders, patchApplication, type Application, type JobOrder } from '../api'

const STATUS_COLORS: Record<string, string> = {
  new: '#6366f1', reviewing: '#f59e0b', shortlisted: '#22c55e', rejected: '#ef4444', hired: '#10b981',
}

export function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([])
  const [jobs, setJobs] = useState<JobOrder[]>([])
  const [filterJob, setFilterJob] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getApplications(), listJobOrders()])
      .then(([ar, jr]) => { setApps(ar.applications); setJobs(jr.job_orders) })
      .finally(() => setLoading(false))
  }, [])

  async function onStatus(id: string, status: string) {
    await patchApplication(id, status)
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, status } : a))
  }

  const filtered = filterJob ? apps.filter((a) => a.job_order_id === filterJob) : apps

  return (
    <div className="page">
      <div className="page-header">
        <h1>Applications</h1>
        <span className="muted small">{filtered.length} total</span>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <select value={filterJob} onChange={(e) => setFilterJob(e.target.value)} style={{ minWidth: 260 }}>
          <option value="">All job orders</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} @ {j.client_company}</option>)}
        </select>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p className="muted">No applications yet. Share your <Link to="/jobs">job board</Link> to start receiving applications.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.map((a) => (
          <div key={a.id} className="form-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.15rem' }}>{a.name}</p>
                <p className="muted small">{a.email}{a.phone ? ` · ${a.phone}` : ''}{a.location ? ` · ${a.location}` : ''}</p>
                <p className="muted small" style={{ marginTop: '0.2rem' }}>
                  Applied for <strong>{a.job_title}</strong> @ {a.client_company} · {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
              <span style={{ padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, background: (STATUS_COLORS[a.status] ?? '#888') + '22', color: STATUS_COLORS[a.status] ?? '#888' }}>
                {a.status}
              </span>
            </div>

            {a.resume_text && (
              <details style={{ marginTop: '0.6rem' }}>
                <summary className="muted small" style={{ cursor: 'pointer' }}>Resume / experience</summary>
                <p style={{ marginTop: '0.4rem', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{a.resume_text.slice(0, 600)}{a.resume_text.length > 600 ? '…' : ''}</p>
              </details>
            )}
            {a.cover_letter && (
              <details style={{ marginTop: '0.4rem' }}>
                <summary className="muted small" style={{ cursor: 'pointer' }}>Cover letter</summary>
                <p style={{ marginTop: '0.4rem', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{a.cover_letter}</p>
              </details>
            )}

            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {['reviewing', 'shortlisted', 'rejected', 'hired'].map((s) => (
                <button key={s} className={`btn ghost small ${a.status === s ? 'active' : ''}`} onClick={() => onStatus(a.id, s)} disabled={a.status === s}>
                  {s}
                </button>
              ))}
              {a.candidate_id && (
                <Link to={`/candidates/${a.candidate_id}`} className="btn ghost small">View candidate →</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
