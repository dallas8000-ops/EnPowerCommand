import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createInterview,
  deleteInterview,
  listCandidates,
  listInterviews,
  listJobOrders,
  patchInterview,
  type Candidate,
  type Interview,
  type JobOrder,
} from '../api'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6366f1',
  completed: '#22c55e',
  canceled:  '#ef4444',
  no_show:   '#f59e0b',
}

export function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ candidate_id: '', job_order_id: '', scheduled_at: '', duration_minutes: 60, location: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    return listInterviews().then((r) => setInterviews(r.interviews)).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    listCandidates().then((r) => setCandidates(r.candidates.filter((c) => c.status === 'active'))).catch(() => null)
    listJobOrders().then((r) => setJobOrders(r.job_orders.filter((j) => j.status === 'open'))).catch(() => null)
  }, [])

  function setF(field: string, val: string | number) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  async function onSchedule() {
    if (!form.candidate_id || !form.job_order_id || !form.scheduled_at) return
    setBusy(true)
    setError(null)
    try {
      await createInterview({
        candidate_id: form.candidate_id,
        job_order_id: form.job_order_id,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: form.duration_minutes,
        location: form.location || undefined,
        notes: form.notes || undefined,
      })
      setShowForm(false)
      setForm({ candidate_id: '', job_order_id: '', scheduled_at: '', duration_minutes: 60, location: '', notes: '' })
      await load()
    } catch {
      setError('Failed to schedule interview.')
    } finally {
      setBusy(false)
    }
  }

  async function onStatus(id: string, status: string) {
    await patchInterview(id, { status })
    setInterviews((prev) => prev.map((i) => i.id === id ? { ...i, status } : i))
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this interview?')) return
    await deleteInterview(id)
    setInterviews((prev) => prev.filter((i) => i.id !== id))
  }

  const upcoming = interviews.filter((i) => i.status === 'scheduled' && new Date(i.scheduled_at) >= new Date())
  const past = interviews.filter((i) => i.status !== 'scheduled' || new Date(i.scheduled_at) < new Date())

  return (
    <div className="page">
      <div className="page-header">
        <h1>Interviews</h1>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Schedule interview'}
        </button>
      </div>

      {error && <div className="banner error">{error}</div>}

      {showForm && (
        <div className="form-card" style={{ marginBottom: '1.5rem' }}>
          <h2>New interview</h2>
          <div className="grid-form">
            <label className="full">
              Candidate *
              <select value={form.candidate_id} onChange={(e) => setF('candidate_id', e.target.value)}>
                <option value="">— Select —</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.title ? ` · ${c.title}` : ''}</option>)}
              </select>
            </label>
            <label className="full">
              Job order *
              <select value={form.job_order_id} onChange={(e) => setF('job_order_id', e.target.value)}>
                <option value="">— Select —</option>
                {jobOrders.map((j) => <option key={j.id} value={j.id}>{j.title} @ {j.client_company}</option>)}
              </select>
            </label>
            <label>
              Date & time *
              <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setF('scheduled_at', e.target.value)} />
            </label>
            <label>
              Duration (minutes)
              <input type="number" min={15} max={480} step={15} value={form.duration_minutes} onChange={(e) => setF('duration_minutes', Number(e.target.value))} />
            </label>
            <label className="full">
              Client interview location / link
              <input value={form.location} onChange={(e) => setF('location', e.target.value)} placeholder="Zoom link from client, office address, phone…" />
            </label>
            <label className="full">
              Notes
              <textarea rows={2} value={form.notes} onChange={(e) => setF('notes', e.target.value)} placeholder="Any prep notes or agenda…" />
            </label>
          </div>
          <div className="actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn primary" onClick={onSchedule} disabled={busy || !form.candidate_id || !form.job_order_id || !form.scheduled_at}>
              {busy ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <section>
            <h2>Upcoming ({upcoming.length})</h2>
            {upcoming.length === 0
              ? <p className="muted small">No upcoming interviews. Schedule one above.</p>
              : <div className="interview-list">{upcoming.map((i) => <InterviewCard key={i.id} interview={i} onStatus={onStatus} onDelete={onDelete} />)}</div>}
          </section>

          {past.length > 0 && (
            <section style={{ marginTop: '1.75rem' }}>
              <h2>Past & other</h2>
              <div className="interview-list">{past.map((i) => <InterviewCard key={i.id} interview={i} onStatus={onStatus} onDelete={onDelete} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function InterviewCard({ interview: i, onStatus, onDelete }: {
  interview: Interview
  onStatus: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="interview-card">
      <div className="interview-card__header">
        <div>
          <span className="interview-card__time">{formatDateTime(i.scheduled_at)}</span>
          <span className="muted small"> · {i.duration_minutes}min</span>
        </div>
        <span className="interview-card__status" style={{ color: STATUS_COLORS[i.status] ?? '#888' }}>{i.status}</span>
      </div>
      <p className="interview-card__who">
        <Link to={`/candidates/${i.candidate_id}`}>{i.candidate_name}</Link>
        <span className="muted"> → </span>
        <Link to={`/job-orders/${i.job_order_id}`}>{i.job_title}</Link>
        <span className="muted small"> @ {i.client_company}</span>
      </p>
      {i.location && <p className="muted small" style={{ marginTop: '0.2rem' }}>📍 {i.location}</p>}
      {i.notes && <p className="muted small" style={{ marginTop: '0.2rem', fontStyle: 'italic' }}>{i.notes}</p>}
      <div className="interview-card__actions">
        {i.status === 'scheduled' && (
          <>
            <button className="btn ghost small" onClick={() => onStatus(i.id, 'completed')}>✓ Completed</button>
            <button className="btn ghost small" onClick={() => onStatus(i.id, 'no_show')}>No show</button>
            <button className="btn ghost small" onClick={() => onStatus(i.id, 'canceled')}>Cancel</button>
          </>
        )}
        <button className="btn ghost small" style={{ color: '#f87171' }} onClick={() => onDelete(i.id)}>Delete</button>
      </div>
    </div>
  )
}
