import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHealth, listLeads, type Health, type Lead } from '../api'

type StageCount = { stage: string; count: number }

function isTouchedThisWeek(lead: Lead): boolean {
  const base = lead.last_contact_at ?? lead.updated_at
  if (!base) return false
  const dt = new Date(base)
  if (Number.isNaN(dt.getTime())) return false
  return Date.now() - dt.getTime() <= 7 * 24 * 60 * 60 * 1000
}

export function Home() {
  const [health, setHealth] = useState<Health | null>(null)
  const [stageCounts, setStageCounts] = useState<StageCount[]>([])
  const [weeklyTotal, setWeeklyTotal] = useState(0)
  let weeklyLabel = 'No leads touched in the last 7 days yet.'
  if (weeklyTotal > 0) {
    const suffix = weeklyTotal === 1 ? '' : 's'
    weeklyLabel = `${weeklyTotal} lead${suffix} touched in the last 7 days.`
  }

  useEffect(() => {
    getHealth().then(setHealth).catch(() =>
      setHealth({ ok: false, service: '', db: false, ai: false })
    )
    listLeads()
      .then((r) => {
        const touched = (r.leads ?? []).filter(isTouchedThisWeek)
        const byStage = new Map<string, number>()
        for (const lead of touched) {
          const stage = (lead.stage || 'unknown').trim().toLowerCase() || 'unknown'
          byStage.set(stage, (byStage.get(stage) ?? 0) + 1)
        }
        setWeeklyTotal(touched.length)
        setStageCounts(
          Array.from(byStage.entries())
            .map(([stage, count]) => ({ stage, count }))
            .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage))
        )
      })
      .catch(() => {
        setWeeklyTotal(0)
        setStageCounts([])
      })
  }, [])

  return (
    <div className="page">
      <p className="eyebrow">EnPower Command</p>
      <h1>Turn prospects into conversations</h1>
      <p className="lede">
        Track leads, generate outreach drafts you edit before sending, and ship a live demo that
        proves full-stack + AI integration — the same stack as your shipped work on GitHub.
      </p>
      <div className="actions">
        <Link className="btn primary" to="/leads">
          Open leads
        </Link>
        <a
          className="btn ghost"
          href="https://github.com/dallas8000-ops/React-Store-Catalog"
          target="_blank"
          rel="noreferrer"
        >
          Reference architecture
        </a>
      </div>
      {health && (
        <ul className="status-line">
          <li data-on={health.ok}>API</li>
          <li data-on={health.db}>Postgres</li>
          <li data-on={health.ai}>OpenAI key</li>
          <li data-on={Boolean(health.auth_required)}>Password login</li>
        </ul>
      )}
      <section className="weekly-stage-card">
        <h2>This week by stage</h2>
        <p className="muted small">{weeklyLabel}</p>
        {stageCounts.length > 0 && (
          <div className="stage-chips">
            {stageCounts.map((s) => (
              <span key={s.stage} className="pill">
                {s.stage}: {s.count}
              </span>
            ))}
          </div>
        )}
      </section>
      <p className="hint">
        Postgres off? Run <code>docker compose up -d</code> then{' '}
        <code>npm run db:init --prefix server</code> with <code>DATABASE_URL</code> in{' '}
        <code>server/.env</code>.
      </p>
    </div>
  )
}
