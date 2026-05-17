import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDashboardAnalytics,
  getHealth,
  listCandidates,
  listJobOrders,
  type DashboardAnalytics,
  type Health,
} from '../api'
import { getAuthMeta } from '../auth'

const STAGE_COLORS: Record<string, string> = {
  sourced:    '#6366f1',
  screening:  '#8b5cf6',
  submitted:  '#3b82f6',
  interview:  '#f59e0b',
  offer:      '#10b981',
  placed:     '#22c55e',
  rejected:   '#ef4444',
}

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="bar-chart">
      {data.map((d) => (
        <div key={d.label} className="bar-chart__row">
          <span className="bar-chart__label">{d.label}</span>
          <div className="bar-chart__track">
            <div
              className="bar-chart__fill"
              style={{ width: `${Math.round((d.value / max) * 100)}%`, background: d.color }}
            />
          </div>
          <span className="bar-chart__val">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Home() {
  const meta = getAuthMeta()
  const [health, setHealth] = useState<Health | null>(null)
  const [candidateCount, setCandidateCount] = useState(0)
  const [openJobCount, setOpenJobCount] = useState(0)
  const [dash, setDash] = useState<DashboardAnalytics | null>(null)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => null)
    listCandidates().then((r) => setCandidateCount(r.candidates.length)).catch(() => null)
    listJobOrders().then((r) => setOpenJobCount(r.job_orders.filter((j) => j.status === 'open').length)).catch(() => null)
    getDashboardAnalytics().then(setDash).catch(() => null)
  }, [])

  const totalPipeline = dash?.stages.reduce((s, x) => s + ((['placed','rejected'].includes(x.stage)) ? 0 : x.count), 0) ?? 0
  const placedCount = dash?.stages.find((s) => s.stage === 'placed')?.count ?? 0

  const chartData = (dash?.stages ?? [])
    .filter((s) => s.count > 0)
    .map((s) => ({ label: s.stage, value: s.count, color: STAGE_COLORS[s.stage] ?? '#6366f1' }))

  return (
    <div className="page">
      <p className="eyebrow">RecruitCommand</p>
      <h1>{meta.tenant_name ? `Welcome, ${meta.tenant_name}` : 'Dashboard'}</h1>

      {health && (
        <ul className="status-line" style={{ marginBottom: '1.5rem' }}>
          <li data-on={health.ok}>API</li>
          <li data-on={health.db}>Postgres</li>
          <li data-on={health.ai}>AI</li>
          <li data-on={Boolean(health.stripe)}>Stripe</li>
        </ul>
      )}

      {/* KPI row */}
      <div className="stat-row">
        <div className="stat-card">
          <p className="stat-card__label">Candidates</p>
          <p className="stat-card__value">{candidateCount}</p>
          <p className="stat-card__sub"><Link to="/candidates" className="link">Manage →</Link></p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Open jobs</p>
          <p className="stat-card__value">{openJobCount}</p>
          <p className="stat-card__sub"><Link to="/job-orders" className="link">Manage →</Link></p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">In pipeline</p>
          <p className="stat-card__value">{totalPipeline}</p>
          <p className="stat-card__sub"><Link to="/pipeline" className="link">View board →</Link></p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Fill rate</p>
          <p className="stat-card__value">{dash ? `${dash.fill_rate}%` : '—'}</p>
          <p className="stat-card__sub" style={{ color: '#86efac' }}>{placedCount} placed · {dash?.jobs_total ?? 0} total</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="actions" style={{ marginBottom: '1.75rem' }}>
        <Link className="btn primary" to="/candidates/new">+ Add candidate</Link>
        <Link className="btn secondary" to="/job-orders/new">+ New job order</Link>
        <Link className="btn ghost" to="/pipeline">Open pipeline board</Link>
        <Link className="btn ghost" to="/ai/jd-generator">✦ AI Tools</Link>
      </div>

      {/* Two-column charts */}
      <div className="dashboard-grid">
        {/* Pipeline bar chart */}
        <div className="form-card">
          <h2>Pipeline by stage</h2>
          {chartData.length > 0
            ? <BarChart data={chartData} />
            : <p className="muted small">No pipeline data yet.</p>}
        </div>

        {/* Velocity table */}
        <div className="form-card">
          <h2>Avg. days per stage</h2>
          {dash && dash.stages.some((s) => s.avg_days !== null) ? (
            <table className="velocity-table">
              <tbody>
                {dash.stages.filter((s) => s.avg_days !== null).map((s) => (
                  <tr key={s.stage}>
                    <td><span className="pill" style={{ background: STAGE_COLORS[s.stage] + '22', color: STAGE_COLORS[s.stage] }}>{s.stage}</span></td>
                    <td className="velocity-table__days">{s.avg_days}d avg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted small">Velocity data appears once candidates move between stages.</p>
          )}
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="form-card" style={{ marginTop: '1.5rem' }}>
        <h2>Recent activity</h2>
        {dash && dash.recent_activity.length > 0 ? (
          <ul className="activity-log">
            {dash.recent_activity.map((a, i) => (
              <li key={i} className="activity-log__item">
                <span className={`tag tag--${a.kind}`}>{a.kind}</span>
                <span className="activity-log__note"><strong>{a.candidate_name}</strong> — {a.note}</span>
                <span className="activity-log__date">{new Date(a.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Activity will appear here as you log notes and move candidates through the pipeline.</p>
        )}
      </div>
    </div>
  )
}
