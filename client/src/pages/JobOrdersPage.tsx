import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listJobOrders, type JobOrder } from '../api'

const STATUSES = ['open', 'on_hold', 'filled', 'canceled'] as const

export function JobOrdersPage() {
  const [orders, setOrders] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    listJobOrders()
      .then((r) => setOrders(r.job_orders))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  const counts = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]))

  return (
    <div className="page">
      <div className="page-header">
        <h1>Job Orders</h1>
        <Link className="btn primary" to="/job-orders/new">+ New order</Link>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <p className="stat-card__label">Open</p>
          <p className="stat-card__value">{counts.open ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">On hold</p>
          <p className="stat-card__value">{counts.on_hold ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Filled</p>
          <p className="stat-card__value">{counts.filled ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Canceled</p>
          <p className="stat-card__value">{counts.canceled ?? 0}</p>
        </div>
      </div>

      <div className="filter-tabs">
        {(['open', 'on_hold', 'filled', 'canceled', 'all'] as const).map((s) => (
          <button key={s} className={`filter-tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <p className="empty-state__title">No job orders</p>
          <p className="empty-state__desc">
            {filter === 'all' ? 'Create your first job order.' : `No ${filter.replace('_', ' ')} orders right now.`}
          </p>
          {filter === 'all' && <Link className="btn primary" to="/job-orders/new">Create order</Link>}
        </div>
      )}

      <div className="card-list">
        {filtered.map((o) => (
          <Link key={o.id} className="card-item" to={`/job-orders/${o.id}`}>
            <div className="card-item__top">
              <div>
                <span className="card-item__title">{o.title}</span>
                <span className="muted small" style={{ marginLeft: '0.5rem' }}>{o.client_company}</span>
              </div>
              <span className={`tag tag--${o.status}`}>{o.status.replace('_', ' ')}</span>
            </div>
            <div className="card-item__sub">
              {o.location && <span>📍 {o.location}</span>}
              {o.remote && <span>🌐 Remote</span>}
              {o.salary_range && <span>💰 {o.salary_range}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
