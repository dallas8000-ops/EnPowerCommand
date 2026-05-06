import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadActivitiesCsv, downloadLeadsCsv, listLeads, type Lead } from '../api'

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listLeads().then((r) => {
      const msg = [r.error, r.hint].filter(Boolean).join(' — ')
      setError(msg || null)
      setLeads(r.leads ?? [])
    })
  }, [])

  return (
    <div className="page stretch">
      <header className="page-head">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>Leads</h1>
        </div>
        <div className="actions-inline" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" onClick={() => downloadLeadsCsv()}>
            Export leads CSV
          </button>
          <button type="button" className="btn ghost" onClick={() => downloadActivitiesCsv()}>
            Export activity CSV
          </button>
          <Link className="btn secondary" to="/leads/import">
            Import job
          </Link>
          <Link className="btn primary" to="/leads/new">
            New lead
          </Link>
        </div>
      </header>

      {error && <div className="banner error">{error}</div>}

      {leads.length === 0 && !error ? (
        <p className="muted">
          No leads yet. Add one — then use <strong>Generate outreach</strong> on the detail page.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Stage</th>
              <th>Last contact</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.company}</td>
                <td>{l.contact_name || '—'}</td>
                <td>
                  <span className="pill">{l.stage}</span>
                </td>
                <td className="muted small">
                  {l.last_contact_at
                    ? new Date(l.last_contact_at).toLocaleDateString()
                    : '—'}
                </td>
                <td className="right">
                  <Link className="link" to={`/leads/${l.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
