import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCandidates, type Candidate } from '../api'

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    listCandidates()
      .then((r) => setCandidates(r.candidates))
      .finally(() => setLoading(false))
  }, [])

  const filtered = candidates.filter((c) => {
    const q = search.toLowerCase()
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.title ?? '').toLowerCase().includes(q) ||
      (c.skills ?? '').toLowerCase().includes(q) ||
      (c.location ?? '').toLowerCase().includes(q)
    const matchesFilter = filter === 'all' || c.status === filter
    return matchesSearch && matchesFilter
  })

  const counts = { active: 0, placed: 0, inactive: 0 }
  for (const c of candidates) {
    if (c.status in counts) counts[c.status as keyof typeof counts]++
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Candidates</h1>
        <Link className="btn primary" to="/candidates/new">+ Add candidate</Link>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <p className="stat-card__label">Total</p>
          <p className="stat-card__value">{candidates.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Active</p>
          <p className="stat-card__value">{counts.active}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Placed</p>
          <p className="stat-card__value">{counts.placed}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Inactive</p>
          <p className="stat-card__value">{counts.inactive}</p>
        </div>
      </div>

      <input
        type="search"
        className="search-bar"
        placeholder="Search name, title, skills, location…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-tabs">
        {(['all', 'active', 'placed', 'inactive'] as const).map((s) => (
          <button key={s} className={`filter-tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">👤</div>
          <p className="empty-state__title">No candidates found</p>
          <p className="empty-state__desc">
            {search ? 'Try a different search term.' : 'Add your first candidate to get started.'}
          </p>
          {!search && <Link className="btn primary" to="/candidates/new">Add candidate</Link>}
        </div>
      )}

      <div className="card-list">
        {filtered.map((c) => (
          <Link key={c.id} className="card-item" to={`/candidates/${c.id}`}>
            <div className="card-item__top">
              <div>
                <span className="card-item__title">{c.name}</span>
                {c.title && <span className="muted small" style={{ marginLeft: '0.5rem' }}>{c.title}</span>}
              </div>
              <span className={`tag tag--${c.status}`}>{c.status}</span>
            </div>
            <div className="card-item__sub">
              {c.location && <span>📍 {c.location}</span>}
              {c.skills && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40ch' }}>{c.skills}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
