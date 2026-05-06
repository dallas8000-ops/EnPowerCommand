import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHealth, type Health } from '../api'

export function Home() {
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    getHealth().then(setHealth).catch(() =>
      setHealth({ ok: false, service: '', db: false, ai: false })
    )
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
      <p className="hint">
        Postgres off? Run <code>docker compose up -d</code> then{' '}
        <code>npm run db:init --prefix server</code> with <code>DATABASE_URL</code> in{' '}
        <code>server/.env</code>.
      </p>
    </div>
  )
}
