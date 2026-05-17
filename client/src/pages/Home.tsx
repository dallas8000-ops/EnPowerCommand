import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getHealth,
  getPipeline,
  getWeeklyAnalytics,
  listCandidates,
  listJobOrders,
  listLeads,
  type ConversionBucket,
  type Health,
  type Lead,
  type Placement,
} from '../api'
import { getAuthMeta } from '../auth'

type StageCount = { stage: string; count: number }

function isTouchedThisWeek(lead: Lead): boolean {
  const base = lead.last_contact_at ?? lead.updated_at
  if (!base) return false
  const dt = new Date(base)
  if (Number.isNaN(dt.getTime())) return false
  return Date.now() - dt.getTime() <= 7 * 24 * 60 * 60 * 1000
}

export function Home() {
  const meta = getAuthMeta()
  const [health, setHealth] = useState<Health | null>(null)
  const [candidateCount, setCandidateCount] = useState(0)
  const [openJobCount, setOpenJobCount] = useState(0)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [stageCounts, setStageCounts] = useState<StageCount[]>([])
  const [weeklyTotal, setWeeklyTotal] = useState(0)
  const [conversionSummary, setConversionSummary] = useState<{
    applied_count: number
    interview_count: number
    conversion_rate: number
  } | null>(null)
  const [byRole, setByRole] = useState<ConversionBucket[]>([])
  const [bySource, setBySource] = useState<ConversionBucket[]>([])

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth({ ok: false, service: '', db: false, ai: false, stripe: false, auth_required: false }))

    listCandidates()
      .then((r) => setCandidateCount(r.candidates.length))
      .catch(() => setCandidateCount(0))

    listJobOrders()
      .then((r) => setOpenJobCount(r.job_orders.filter((j) => j.status === 'open').length))
      .catch(() => setOpenJobCount(0))

    getPipeline()
      .then((r) => setPlacements(r.placements))
      .catch(() => setPlacements([]))

    listLeads()
      .then((r) => {
        const touched = (r.leads ?? []).filter(isTouchedThisWeek)
        const byStage = new Map<string, number>()
        for (const lead of touched) {
          const stage = (lead.stage ?? 'unknown').trim().toLowerCase() || 'unknown'
          byStage.set(stage, (byStage.get(stage) ?? 0) + 1)
        }
        setWeeklyTotal(touched.length)
        setStageCounts(
          Array.from(byStage.entries())
            .map(([stage, count]) => ({ stage, count }))
            .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage))
        )
      })
      .catch(() => { setWeeklyTotal(0); setStageCounts([]) })

    getWeeklyAnalytics()
      .then((r) => { setConversionSummary(r.summary); setByRole(r.by_role ?? []); setBySource(r.by_source ?? []) })
      .catch(() => { setConversionSummary(null); setByRole([]); setBySource([]) })
  }, [])

  const activePlacements = placements.filter((p) => !['placed', 'rejected'].includes(p.stage))
  const placedThisRun = placements.filter((p) => p.stage === 'placed').length

  return (
    <div className="page">
      <p className="eyebrow">RecruitCommand</p>
      <h1>
        {meta.tenant_name ? `Welcome, ${meta.tenant_name}` : 'Dashboard'}
      </h1>

      {health && (
        <ul className="status-line" style={{ marginBottom: '1.5rem' }}>
          <li data-on={health.ok}>API</li>
          <li data-on={health.db}>Postgres</li>
          <li data-on={health.ai}>AI</li>
          <li data-on={Boolean(health.stripe)}>Stripe</li>
        </ul>
      )}

      {/* Recruiter KPI row */}
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
          <p className="stat-card__value">{activePlacements.length}</p>
          <p className="stat-card__sub"><Link to="/pipeline" className="link">View board →</Link></p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Placed</p>
          <p className="stat-card__value">{placedThisRun}</p>
          <p className="stat-card__sub" style={{ color: '#86efac' }}>All time</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="actions" style={{ marginBottom: '1.5rem' }}>
        <Link className="btn primary" to="/candidates/new">+ Add candidate</Link>
        <Link className="btn secondary" to="/job-orders/new">+ New job order</Link>
        <Link className="btn ghost" to="/pipeline">Open pipeline board</Link>
      </div>

      {/* Pipeline snapshot */}
      {placements.length > 0 && (
        <section className="weekly-stage-card" style={{ marginBottom: '1rem' }}>
          <h2>Pipeline snapshot</h2>
          <div className="stage-chips">
            {(['sourced','screening','submitted','interview','offer','placed','rejected'] as const).map((s) => {
              const count = placements.filter((p) => p.stage === s).length
              if (count === 0) return null
              return (
                <span key={s} className={`tag tag--${s}`}>
                  {s}: {count}
                </span>
              )
            })}
          </div>
        </section>
      )}

      {/* Lead activity (legacy job search analytics) */}
      <section className="weekly-stage-card">
        <h2>Lead activity — this week</h2>
        <p className="muted small">
          {weeklyTotal > 0
            ? `${weeklyTotal} lead${weeklyTotal === 1 ? '' : 's'} touched in the last 7 days.`
            : 'No leads touched this week.'}
        </p>
        {stageCounts.length > 0 && (
          <div className="stage-chips">
            {stageCounts.map((s) => (
              <span key={s.stage} className="pill">{s.stage}: {s.count}</span>
            ))}
          </div>
        )}
      </section>

      <section className="weekly-stage-card" style={{ marginTop: '0.75rem' }}>
        <h2>Conversion analytics (applied → interview)</h2>
        {conversionSummary ? (
          <>
            <p className="muted small">
              Applied: <strong>{conversionSummary.applied_count}</strong> · Interview:{' '}
              <strong>{conversionSummary.interview_count}</strong> · Rate:{' '}
              <strong>{Math.round(conversionSummary.conversion_rate * 100)}%</strong>
            </p>
            <div className="analytics-grid">
              <div>
                <h3>By role</h3>
                <ul className="analytics-list">
                  {byRole.length === 0
                    ? <li className="muted small">No data this week.</li>
                    : byRole.slice(0, 6).map((x) => (
                        <li key={x.label}>
                          <span>{x.label}</span>
                          <span className="muted small">{x.interview_count}/{x.applied_count} ({Math.round(x.conversion_rate * 100)}%)</span>
                        </li>
                      ))}
                </ul>
              </div>
              <div>
                <h3>By source</h3>
                <ul className="analytics-list">
                  {bySource.length === 0
                    ? <li className="muted small">No data this week.</li>
                    : bySource.slice(0, 6).map((x) => (
                        <li key={x.label}>
                          <span>{x.label}</span>
                          <span className="muted small">{x.interview_count}/{x.applied_count} ({Math.round(x.conversion_rate * 100)}%)</span>
                        </li>
                      ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p className="muted small">Analytics will appear once activity data is available.</p>
        )}
      </section>
    </div>
  )
}
