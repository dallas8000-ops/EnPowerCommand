import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublicJobs, type PublicJob } from '../api'

export function JobBoardPage() {
  const [jobs, setJobs] = useState<PublicJob[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPublicJobs()
      .then((r) => setJobs(r.jobs))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase()
    return (
      j.title.toLowerCase().includes(q) ||
      j.client_company.toLowerCase().includes(q) ||
      (j.location ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="page">
      <p className="eyebrow">Open Positions</p>
      <div className="page-header">
        <h1 style={{ margin: 0 }}>We're hiring</h1>
        <Link className="btn primary" to="/post-job">
          Post a job
        </Link>
      </div>
      <p className="lede" style={{ marginBottom: '1.5rem' }}>
        Browse open roles we're actively recruiting for. Don't see a fit?{' '}
        <Link to="/post-job" className="link">Submit your opening</Link> and we'll reach out.
      </p>

      <input
        className="search-bar"
        placeholder="Search by title, company, or location…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className="muted small">Loading positions…</p>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__icon">📋</p>
          <p className="empty-state__title">No open positions right now</p>
          <p className="empty-state__desc">Check back soon or submit your hiring need below.</p>
          <Link className="btn primary" to="/post-job">Post a job</Link>
        </div>
      )}

      <div className="card-list">
        {filtered.map((j) => (
          <div key={j.id} className="card-item" style={{ cursor: 'default' }}>
            <div className="card-item__top">
              <div>
                <p className="card-item__title">{j.title}</p>
                <p className="card-item__sub">
                  <span>{j.client_company}</span>
                  {j.location && <span>📍 {j.location}</span>}
                  {j.remote && <span className="tag tag--active">Remote</span>}
                  {j.salary_range && <span>💰 {j.salary_range}</span>}
                </p>
              </div>
              <Link to="/post-job" className="btn ghost" style={{ flexShrink: 0, fontSize: '0.82rem' }}>
                Submit candidate
              </Link>
            </div>
            {j.description && (
              <p className="muted small" style={{ marginTop: '0.6rem', lineHeight: 1.55 }}>
                {j.description.slice(0, 220)}{j.description.length > 220 ? '…' : ''}
              </p>
            )}
            <p className="muted small" style={{ marginTop: '0.5rem' }}>
              Posted {new Date(j.opened_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
