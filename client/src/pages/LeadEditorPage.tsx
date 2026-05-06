import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createLead,
  generateOutreach,
  getLead,
  getResumeContext,
  listActivities,
  patchLead,
  postActivity,
  type Lead,
  type LeadActivity,
  type OutreachResult,
} from '../api'

const stages = ['new', 'applied', 'contacted', 'interview', 'call', 'proposal', 'won', 'lost']

const activityKindOptions = [
  { value: 'note', label: 'Note' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'other', label: 'Other' },
]

function toLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatOutreachForClipboard(o: OutreachResult): string {
  const lines: string[] = ['Subject lines', ...((o.subject_lines ?? []).map((s) => `• ${s}`)), '', 'Drafts']
  for (const d of o.drafts ?? []) {
    lines.push('', `--- ${d.label} ---`, d.body, '')
  }
  return lines.join('\n').trim()
}

export function LeadEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [lead, setLead] = useState<Partial<Lead>>({
    company: '',
    contact_name: '',
    role: '',
    url: '',
    notes: '',
    stage: 'new',
  })
  const [lastContactLocal, setLastContactLocal] = useState('')
  const [saving, setSaving] = useState(false)
  const [outreach, setOutreach] = useState<OutreachResult | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [actKind, setActKind] = useState('note')
  const [actNote, setActNote] = useState('')
  const [logging, setLogging] = useState(false)
  const [copyState, setCopyState] = useState<string | null>(null)
  const [quickApplyBusy, setQuickApplyBusy] = useState(false)
  const [quickApplyState, setQuickApplyState] = useState<string | null>(null)

  useEffect(() => {
    if (isNew || !id) return
    getLead(id).then((r) => {
      if (r.lead) {
        setLead({
          ...r.lead,
          contact_name: r.lead.contact_name ?? '',
          role: r.lead.role ?? '',
          url: r.lead.url ?? '',
          notes: r.lead.notes ?? '',
        })
        setLastContactLocal(toLocalDatetimeValue(r.lead.last_contact_at))
      } else {
        setBanner('Lead not found')
      }
    })
    listActivities(id).then((r) => setActivities(r.activities ?? []))
  }, [id, isNew])

  async function refreshActivities() {
    if (!id || isNew) return
    const r = await listActivities(id)
    setActivities(r.activities ?? [])
    const lr = await getLead(id)
    if (lr.lead) {
      setLead((prev) => ({ ...prev, ...lr.lead, last_contact_at: lr.lead!.last_contact_at }))
      setLastContactLocal(toLocalDatetimeValue(lr.lead.last_contact_at))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setBanner(null)
    try {
      if (isNew) {
        const r = await createLead({
          company: lead.company ?? '',
          contact_name: lead.contact_name || null,
          role: lead.role || null,
          url: lead.url || null,
          notes: lead.notes || null,
          stage: lead.stage ?? 'new',
        })
        if (r.lead) navigate(`/leads/${r.lead.id}`, { replace: true })
        else setBanner(r.message ?? 'Could not create lead')
      } else if (id) {
        const lastIso =
          lastContactLocal.trim() === ''
            ? null
            : new Date(lastContactLocal).toISOString()
        const r = await patchLead(id, {
          company: lead.company,
          contact_name: lead.contact_name || null,
          role: lead.role || null,
          url: lead.url || null,
          notes: lead.notes || null,
          stage: lead.stage,
          last_contact_at: lastIso,
        })
        if (r.lead) {
          setLead({ ...r.lead, contact_name: r.lead.contact_name ?? '' })
          setLastContactLocal(toLocalDatetimeValue(r.lead.last_contact_at))
        } else setBanner('Could not save')
      }
    } finally {
      setSaving(false)
    }
  }

  async function onGenerate() {
    setLoadingAi(true)
    setOutreach(null)
    setBanner(null)
    try {
      const resume = await getResumeContext()
      const res = await generateOutreach(
        isNew
          ? {
              company: lead.company ?? '',
              contact_name: lead.contact_name || null,
              role: lead.role || null,
              url: lead.url || null,
              notes: lead.notes || null,
              resume_context: resume || undefined,
            }
          : { lead_id: id!, resume_context: resume || undefined }
      )
      if (res.status >= 400) {
        setBanner(res.error ?? 'Outreach failed')
      }
      setOutreach(res)
    } finally {
      setLoadingAi(false)
    }
  }

  async function onLogActivity(e: FormEvent) {
    e.preventDefault()
    if (!id || isNew) return
    setLogging(true)
    setBanner(null)
    try {
      await postActivity(id, { kind: actKind, note: actNote.trim() || null })
      setActNote('')
      await refreshActivities()
    } catch {
      setBanner('Could not log activity')
    } finally {
      setLogging(false)
    }
  }

  async function copyAllDrafts() {
    if (!outreach) return
    const text = formatOutreachForClipboard(outreach)
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('Copied to clipboard')
      globalThis.setTimeout(() => setCopyState(null), 2500)
    } catch {
      setCopyState('Copy blocked — select text manually')
      globalThis.setTimeout(() => setCopyState(null), 4000)
    }
  }

  async function onAppliedNow() {
    if (!id || isNew) return
    setQuickApplyBusy(true)
    setQuickApplyState(null)
    setBanner(null)
    const nowIso = new Date().toISOString()
    try {
      await patchLead(id, { stage: 'applied', last_contact_at: nowIso })
      await postActivity(id, { kind: 'applied', note: 'Applied now (quick action)' })
      await refreshActivities()
      setQuickApplyState('Marked as applied and logged in activity.')
      globalThis.setTimeout(() => setQuickApplyState(null), 3000)
    } catch {
      setQuickApplyState('Could not mark as applied right now.')
      globalThis.setTimeout(() => setQuickApplyState(null), 4000)
    } finally {
      setQuickApplyBusy(false)
    }
  }

  return (
    <div className="page stretch">
      <header className="page-head">
        <div>
          <p className="eyebrow">{isNew ? 'New' : 'Edit'}</p>
          <h1>{isNew ? 'Add lead' : lead.company || 'Lead'}</h1>
        </div>
        <Link className="btn ghost" to="/leads">
          Back
        </Link>
      </header>

      {banner && <div className="banner error">{banner}</div>}

      <form className="grid-form" onSubmit={onSubmit}>
        <label>
          Company *
          <input
            required
            value={lead.company ?? ''}
            onChange={(e) => setLead({ ...lead, company: e.target.value })}
          />
        </label>
        <label>
          Contact name
          <input
            value={lead.contact_name ?? ''}
            onChange={(e) => setLead({ ...lead, contact_name: e.target.value })}
          />
        </label>
        <label>
          Role / title
          <input
            value={lead.role ?? ''}
            onChange={(e) => setLead({ ...lead, role: e.target.value })}
          />
        </label>
        <label>
          URL
          <input
            placeholder="https://"
            value={lead.url ?? ''}
            onChange={(e) => setLead({ ...lead, url: e.target.value })}
          />
        </label>
        <label className="full">
          Notes (pain, stack, posting, etc.)
          <textarea
            rows={4}
            value={lead.notes ?? ''}
            onChange={(e) => setLead({ ...lead, notes: e.target.value })}
          />
        </label>
        <label>
          Stage
          <select
            value={lead.stage ?? 'new'}
            onChange={(e) => setLead({ ...lead, stage: e.target.value })}
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {!isNew && (
          <label>
            Last contact (local time)
            <input
              type="datetime-local"
              value={lastContactLocal}
              onChange={(e) => setLastContactLocal(e.target.value)}
            />
          </label>
        )}
        <div className="full actions-inline">
          <button className="btn primary" type="submit" disabled={saving}>
            {isNew ? 'Create lead' : 'Save'}
          </button>
          {!isNew && (
            <button
              className="btn secondary"
              type="button"
              onClick={onAppliedNow}
              disabled={quickApplyBusy}
            >
              {quickApplyBusy ? 'Applying…' : 'Applied now'}
            </button>
          )}
          <button
            className="btn secondary"
            type="button"
            onClick={onGenerate}
            disabled={loadingAi || (!isNew ? false : !(lead.company ?? '').trim())}
          >
            {loadingAi ? 'Generating…' : 'Generate outreach'}
          </button>
        </div>
        {!isNew && quickApplyState && <p className="full muted small">{quickApplyState}</p>}
      </form>

      {!isNew && id && (
        <section className="activity-section">
          <h2>Activity log</h2>
          <p className="muted small">
            <strong>Applied</strong> / <strong>Contacted</strong> / <strong>Interview</strong> /{' '}
            <strong>Follow-up</strong> also set <strong>Last contact</strong> to now. Export all
            activities from <Link to="/leads">Leads</Link> → CSV.
          </p>
          <ul className="activity-list">
            {activities.length === 0 ? (
              <li className="muted">No entries yet.</li>
            ) : (
              activities.map((a) => (
                <li key={a.id}>
                  <strong>{a.kind}</strong>{' '}
                  <span className="muted small">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                  {a.note ? <div className="activity-note">{a.note}</div> : null}
                </li>
              ))
            )}
          </ul>
          <form className="grid-form activity-form" onSubmit={onLogActivity}>
            <label>
              Type
              <select value={actKind} onChange={(e) => setActKind(e.target.value)}>
                {activityKindOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Note (optional)
              <input
                value={actNote}
                onChange={(e) => setActNote(e.target.value)}
                placeholder="e.g. Submitted via Greenhouse; follow up Friday"
              />
            </label>
            <button className="btn secondary" type="submit" disabled={logging}>
              {logging ? 'Logging…' : 'Log activity'}
            </button>
          </form>
        </section>
      )}

      {outreach && (
        <section className="outreach">
          <div className="page-head" style={{ marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Drafts</h2>
            <button type="button" className="btn secondary" onClick={copyAllDrafts}>
              Copy all
            </button>
          </div>
          {copyState && <p className="muted small">{copyState}</p>}
          {outreach.disclaimer && <p className="muted small">{outreach.disclaimer}</p>}
          {outreach.model && <p className="muted small">Model: {outreach.model}</p>}
          <div className="subjects">
            <h3>Subject lines</h3>
            <ul>
              {outreach.subject_lines?.map((s, i) => (
                <li key={i}>
                  <code>{s}</code>
                </li>
              ))}
            </ul>
          </div>
          {outreach.drafts?.map((d, i) => (
            <article key={i} className="draft-card">
              <header>{d.label}</header>
              <pre>{d.body}</pre>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
