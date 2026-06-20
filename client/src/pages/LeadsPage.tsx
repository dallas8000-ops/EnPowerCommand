import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  downloadActivitiesCsv,
  downloadLeadsCsv,
  getWeeklyAnalytics,
  listLeads,
  type ConversionBucket,
  type Lead,
} from '../api'

const REMINDER_NEXT_KEY = 'enpower_export_reminder_next_at'
const REMINDER_LAST_KEY = 'enpower_export_last_at'
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showReminder, setShowReminder] = useState(false)
  const [reminderText, setReminderText] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [dueReminders, setDueReminders] = useState<Lead[]>([])
  const [weeklySummary, setWeeklySummary] = useState<{
    applied_count: number
    interview_count: number
    conversion_rate: number
  } | null>(null)
  const [byRole, setByRole] = useState<ConversionBucket[]>([])
  const [bySource, setBySource] = useState<ConversionBucket[]>([])

  useEffect(() => {
    listLeads().then((r) => {
      const msg = [r.error, r.hint].filter(Boolean).join(' — ')
      setError(msg || null)
      const all = r.leads ?? []
      setLeads(all)
      const now = Date.now()
      setDueReminders(
        all
          .filter((l) => {
            if (!l.next_action_at) return false
            const t = new Date(l.next_action_at).getTime()
            return !Number.isNaN(t) && t <= now
          })
          .sort(
            (a, b) =>
              new Date(a.next_action_at ?? 0).getTime() - new Date(b.next_action_at ?? 0).getTime()
          )
      )
    })
    const now = Date.now()
    const nextAt = Number(localStorage.getItem(REMINDER_NEXT_KEY) || 0)
    const lastAt = Number(localStorage.getItem(REMINDER_LAST_KEY) || 0)
    if (nextAt && now < nextAt) return
    if (!lastAt) {
      setReminderText('Set up your weekly proof trail: export leads + activity CSV once a week.')
      setShowReminder(true)
      return
    }
    if (now - lastAt >= WEEK_MS) {
      setReminderText('It has been over 7 days since your last CSV export.')
      setShowReminder(true)
    }
    getWeeklyAnalytics()
      .then((r) => {
        setWeeklySummary(r.summary)
        setByRole(r.by_role ?? [])
        setBySource(r.by_source ?? [])
      })
      .catch(() => {
        setWeeklySummary(null)
        setByRole([])
        setBySource([])
      })
  }, [])

  function markReminder(msFromNow: number) {
    localStorage.setItem(REMINDER_NEXT_KEY, String(Date.now() + msFromNow))
    setShowReminder(false)
  }

  async function exportBothNow() {
    setExportBusy(true)
    try {
      await downloadLeadsCsv()
      await downloadActivitiesCsv()
      const now = Date.now()
      localStorage.setItem(REMINDER_LAST_KEY, String(now))
      localStorage.setItem(REMINDER_NEXT_KEY, String(now + WEEK_MS))
      setShowReminder(false)
    } finally {
      setExportBusy(false)
    }
  }

  async function copyFollowUpTemplate(lead: Lead) {
    const who = (lead.contact_name ?? '').trim() || 'there'
    const role = (lead.role ?? '').trim()
    const roleLine = role ? ` for the ${role} role` : ''
    const text = `Hi ${who}, following up on my application${roleLine} at ${lead.company}. Happy to share any additional details if helpful.`
    await navigator.clipboard.writeText(text)
  }

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
      {showReminder && (
        <div className="banner export-reminder">
          <strong>Weekly export reminder</strong>
          <p className="muted small">{reminderText}</p>
          <div className="actions-inline">
            <button type="button" className="btn secondary" onClick={exportBothNow} disabled={exportBusy}>
              {exportBusy ? 'Exporting…' : 'Export both now'}
            </button>
            <button type="button" className="btn ghost" onClick={() => markReminder(DAY_MS)}>
              Remind tomorrow
            </button>
            <button type="button" className="btn ghost" onClick={() => markReminder(WEEK_MS)}>
              Dismiss this week
            </button>
          </div>
        </div>
      )}
      {weeklySummary && (
        <section className="weekly-stage-card">
          <h2>This week: applied → interview</h2>
          <p className="muted small">
            Applied: <strong>{weeklySummary.applied_count}</strong> · Interview:{' '}
            <strong>{weeklySummary.interview_count}</strong> · Conversion:{' '}
            <strong>{Math.round(weeklySummary.conversion_rate * 100)}%</strong>
          </p>
          <div className="analytics-grid">
            <div>
              <h3>By role</h3>
              <ul className="analytics-list">
                {byRole.length === 0 ? (
                  <li className="muted small">No applied/interview activity this week.</li>
                ) : (
                  byRole.slice(0, 5).map((x) => (
                    <li key={x.label}>
                      <span>{x.label}</span>
                      <span className="muted small">
                        {x.interview_count}/{x.applied_count} (
                        {Math.round(x.conversion_rate * 100)}%)
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3>By source</h3>
              <ul className="analytics-list">
                {bySource.length === 0 ? (
                  <li className="muted small">No source trends yet this week.</li>
                ) : (
                  bySource.slice(0, 5).map((x) => (
                    <li key={x.label}>
                      <span>{x.label}</span>
                      <span className="muted small">
                        {x.interview_count}/{x.applied_count} (
                        {Math.round(x.conversion_rate * 100)}%)
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {dueReminders.length > 0 && (
        <div className="banner followup-reminder">
          <strong>Follow-up reminders due now: {dueReminders.length}</strong>
          <ul className="followup-list">
            {dueReminders.slice(0, 6).map((lead) => (
              <li key={lead.id}>
                <span>
                  <strong>{lead.company}</strong>{' '}
                  <span className="muted small">
                    {lead.next_action_at ? new Date(lead.next_action_at).toLocaleString() : ''}
                  </span>
                </span>
                <span className="actions-inline">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => copyFollowUpTemplate(lead)}
                  >
                    Copy follow-up
                  </button>
                  <Link className="link" to={`/leads/${lead.id}`}>
                    Open
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              <th>Next action</th>
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
                  {l.next_action_at
                    ? new Date(l.next_action_at).toLocaleDateString()
                    : '—'}
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
