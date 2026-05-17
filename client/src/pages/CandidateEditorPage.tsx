import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createCandidate,
  deleteCandidate,
  getCandidate,
  getCandidateEmails,
  listCandidateActivities,
  patchCandidate,
  parseResume,
  postCandidateActivity,
  sendEmail,
  type Candidate,
  type EmailLog,
  type LeadActivity,
} from '../api'

export function CandidateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const creating = id === 'new'

  const [form, setForm] = useState<Partial<Candidate>>({ status: 'active' })
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [actNote, setActNote] = useState('')
  const [actKind, setActKind] = useState('note')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!creating)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [resumeText, setResumeText] = useState('')
  const [parseBusy, setParseBusy] = useState(false)
  const [parseMsg, setParseMsg] = useState<string | null>(null)
  const [emails, setEmails] = useState<EmailLog[]>([])
  const [showCompose, setShowCompose] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function onParseResume() {
    if (!resumeText.trim()) return
    setParseBusy(true)
    setParseMsg(null)
    try {
      const r = await parseResume(resumeText)
      const c = r.candidate
      setForm((f) => ({
        ...f,
        name: c.name || f.name,
        email: c.email ?? f.email,
        phone: c.phone ?? f.phone,
        title: c.title ?? f.title,
        location: c.location ?? f.location,
        skills: c.skills ?? f.skills,
        notes: c.notes ?? f.notes,
      }))
      setParseMsg(r.source === 'ai' ? '✓ Fields populated from resume.' : '✓ Basic info extracted — fill in remaining fields.')
      setResumeText('')
    } finally {
      setParseBusy(false)
    }
  }

  useEffect(() => {
    if (creating || !id) return
    Promise.all([getCandidate(id), listCandidateActivities(id), getCandidateEmails(id)]).then(([cr, ar, er]) => {
      if (cr.candidate) setForm(cr.candidate)
      setActivities(ar.activities ?? [])
      setEmails(er.emails ?? [])
      setLoading(false)
    })
  }, [id, creating])

  async function onSendEmail() {
    if (!id || !form.email || !emailSubject.trim() || !emailBody.trim()) return
    setEmailBusy(true); setEmailMsg(null)
    try {
      await sendEmail({ to: form.email, subject: emailSubject, body: emailBody, candidate_id: id })
      setEmailMsg({ text: '✓ Email sent and logged.', ok: true })
      setEmailSubject(''); setEmailBody(''); setShowCompose(false)
      const er = await getCandidateEmails(id)
      setEmails(er.emails ?? [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send'
      setEmailMsg({ text: msg, ok: false })
    } finally { setEmailBusy(false) }
  }

  function set(field: keyof Candidate, val: string | null) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  async function onSave() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      if (creating) {
        const r = await createCandidate({ ...form, name: form.name ?? '' })
        if (r.candidate) { navigate(`/candidates/${r.candidate.id}`, { replace: true }); return }
        setError(r.error ?? 'Failed to create')
      } else {
        const r = await patchCandidate(id!, form)
        if (r.candidate) { setForm(r.candidate); setSaved(true) }
        else setError(r.error ?? 'Failed to save')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!id || creating) return
    if (!confirm('Delete this candidate? This cannot be undone.')) return
    await deleteCandidate(id)
    navigate('/candidates', { replace: true })
  }

  async function onAddActivity() {
    if (!id || creating || !actNote.trim()) return
    const r = await postCandidateActivity(id, { kind: actKind, note: actNote })
    if (r.activity) {
      setActivities((prev) => [r.activity!, ...prev])
      setActNote('')
    }
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>{creating ? 'New candidate' : (form.name ?? 'Edit candidate')}</h1>
        {!creating && <span className={`tag tag--${form.status ?? 'active'}`}>{form.status}</span>}
      </div>

      {error && <div className="banner error">{error}</div>}
      {saved && <div className="banner success">Changes saved.</div>}

      {creating && (
        <div className="form-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>✦ Parse resume with AI</h2>
            <span className="muted small">Optional — paste to auto-fill</span>
          </div>
          {parseMsg && <div className="banner success" style={{ marginBottom: '0.75rem' }}>{parseMsg}</div>}
          <textarea
            rows={6}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste the candidate's resume text here…"
            style={{ width: '100%', marginBottom: '0.75rem' }}
          />
          <button className="btn primary small" onClick={onParseResume} disabled={parseBusy || !resumeText.trim()}>
            {parseBusy ? 'Parsing…' : 'Parse resume'}
          </button>
        </div>
      )}

      <div className="form-card">
        <h2>Contact info</h2>
        <div className="grid-form">
          <label className="full">
            Full name *
            <input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </label>
          <label>
            Phone
            <input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </label>
          <label>
            Current title
            <input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label>
            Location
            <input value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} />
          </label>
          <label>
            Resume URL
            <input type="url" value={form.resume_url ?? ''} onChange={(e) => set('resume_url', e.target.value)} placeholder="https://…" />
          </label>
          <label>
            Status
            <select value={form.status ?? 'active'} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="placed">Placed</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="full">
            Skills / Tech stack
            <input value={form.skills ?? ''} onChange={(e) => set('skills', e.target.value)} placeholder="React, Node.js, PostgreSQL…" />
          </label>
          <label className="full">
            Notes
            <textarea rows={4} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onSave} disabled={busy || !form.name}>
          {busy ? 'Saving…' : creating ? 'Create candidate' : 'Save changes'}
        </button>
        {!creating && (
          <button className="btn ghost" style={{ color: '#f87171' }} onClick={onDelete}>
            Delete candidate
          </button>
        )}
      </div>

      {!creating && form.email && (
        <section className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Emails</h2>
            <button className="btn ghost small" onClick={() => { setShowCompose((v) => !v); setEmailMsg(null) }}>
              {showCompose ? 'Cancel' : '+ Compose'}
            </button>
          </div>
          {showCompose && (
            <div className="form-card" style={{ marginBottom: '1rem' }}>
              <div className="grid-form">
                <label className="full">
                  Subject
                  <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject…" />
                </label>
                <label className="full">
                  Message
                  <textarea rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder={`Email to ${form.email}…`} />
                </label>
              </div>
              {emailMsg && <p className="muted small" style={{ marginTop: '0.5rem', color: emailMsg.ok ? '#22c55e' : '#f87171' }}>{emailMsg.text}</p>}
              <div className="actions" style={{ marginTop: '0.75rem' }}>
                <button className="btn primary" onClick={onSendEmail} disabled={emailBusy || !emailSubject.trim() || !emailBody.trim()}>
                  {emailBusy ? 'Sending…' : `Send to ${form.email}`}
                </button>
              </div>
            </div>
          )}
          {emails.length > 0 ? (
            <ul className="activity-log">
              {emails.map((e) => (
                <li key={e.id} className="activity-log__item">
                  <span className={`tag tag--${e.status === 'sent' ? 'contacted' : 'rejected'}`}>{e.direction}</span>
                  <span className="activity-log__note"><strong>{e.subject}</strong> — {e.body.slice(0, 80)}{e.body.length > 80 ? '…' : ''}</span>
                  <span className="activity-log__date">{new Date(e.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">No emails sent yet.</p>}
        </section>
      )}

      {!creating && (
        <section className="section">
          <h2>Activity log</h2>
          <div className="activity-input-row">
            <select value={actKind} onChange={(e) => setActKind(e.target.value)}>
              <option value="note">Note</option>
              <option value="contacted">Contacted</option>
              <option value="screening">Screening</option>
              <option value="submitted">Submitted</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="placed">Placed</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              value={actNote}
              onChange={(e) => setActNote(e.target.value)}
              placeholder="Add a note…"
              onKeyDown={(e) => e.key === 'Enter' && onAddActivity()}
            />
            <button className="btn primary" onClick={onAddActivity} disabled={!actNote.trim()}>Add</button>
          </div>
          <ul className="activity-log">
            {activities.map((a) => (
              <li key={a.id} className="activity-log__item">
                <span className={`tag tag--${a.kind}`}>{a.kind}</span>
                <span className="activity-log__note">{a.note}</span>
                <span className="activity-log__date">{new Date(a.created_at).toLocaleDateString()}</span>
              </li>
            ))}
            {activities.length === 0 && (
              <li className="muted small" style={{ padding: '0.65rem 0' }}>No activity logged yet.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
