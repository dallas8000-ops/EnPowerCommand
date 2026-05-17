import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createJobOrder, deleteJobOrder, generateScreeningQuestions, getJobOrder, getJobOrderMatches, patchJobOrder, type CandidateMatch, type JobOrder } from '../api'

export function JobOrderEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const creating = id === 'new'

  const [form, setForm] = useState<Partial<JobOrder>>({ status: 'open', remote: false })
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!creating)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [questions, setQuestions] = useState<string[]>([])
  const [qBusy, setQBusy] = useState(false)
  const [qSource, setQSource] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [matches, setMatches] = useState<CandidateMatch[]>([])
  const [matchBusy, setMatchBusy] = useState(false)
  const [matchNote, setMatchNote] = useState<string | null>(null)

  async function onFindMatches() {
    if (!id || creating) return
    setMatchBusy(true)
    setMatches([])
    setMatchNote(null)
    try {
      const r = await getJobOrderMatches(id)
      setMatches(r.matches)
      if (r.note) setMatchNote(r.note)
    } finally {
      setMatchBusy(false)
    }
  }

  async function onGenerateQuestions() {
    if (!id || creating) return
    setQBusy(true)
    setQuestions([])
    setQSource(null)
    try {
      const r = await generateScreeningQuestions(id)
      setQuestions(r.questions)
      setQSource(r.source)
    } finally {
      setQBusy(false)
    }
  }

  function copyQuestions() {
    const text = questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (creating || !id) return
    getJobOrder(id).then((r) => {
      if (r.job_order) setForm(r.job_order)
      setLoading(false)
    })
  }, [id, creating])

  function set(field: keyof JobOrder, val: string | boolean | null) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  async function onSave() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      if (creating) {
        const r = await createJobOrder({ ...form, client_company: form.client_company ?? '', title: form.title ?? '' })
        if (r.job_order) { navigate(`/job-orders/${r.job_order.id}`, { replace: true }); return }
        setError(r.error ?? 'Failed to create')
      } else {
        const r = await patchJobOrder(id!, form)
        if (r.job_order) { setForm(r.job_order); setSaved(true) }
        else setError(r.error ?? 'Failed to save')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!id || creating) return
    if (!confirm('Delete this job order? Associated pipeline placements will also be removed.')) return
    await deleteJobOrder(id)
    navigate('/job-orders', { replace: true })
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>{creating ? 'New job order' : (form.title ?? 'Edit order')}</h1>
        {!creating && <span className={`tag tag--${form.status ?? 'open'}`}>{form.status?.replace('_', ' ')}</span>}
      </div>

      {error && <div className="banner error">{error}</div>}
      {saved && <div className="banner success">Changes saved.</div>}

      <div className="form-card">
        <h2>Order details</h2>
        <div className="grid-form">
          <label>
            Client company *
            <input value={form.client_company ?? ''} onChange={(e) => set('client_company', e.target.value)} required />
          </label>
          <label>
            Job title *
            <input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} required />
          </label>
          <label>
            Location
            <input value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="City, State" />
          </label>
          <label>
            Salary / Rate range
            <input value={form.salary_range ?? ''} onChange={(e) => set('salary_range', e.target.value)} placeholder="$80k–$100k" />
          </label>
          <label>
            Status
            <select value={form.status ?? 'open'} onChange={(e) => set('status', e.target.value)}>
              <option value="open">Open</option>
              <option value="on_hold">On hold</option>
              <option value="filled">Filled</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.remote ?? false} onChange={(e) => set('remote', e.target.checked)} />
            Remote position
          </label>
          <label className="full">
            Description / Requirements
            <textarea rows={6} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Paste the job description or requirements here…" />
          </label>
        </div>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onSave} disabled={busy || !form.client_company || !form.title}>
          {busy ? 'Saving…' : creating ? 'Create order' : 'Save changes'}
        </button>
        {!creating && (
          <button className="btn ghost" style={{ color: '#f87171' }} onClick={onDelete}>
            Delete order
          </button>
        )}
      </div>

      {!creating && form.status === 'open' && (
        <div className="form-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Post to Job Boards</h2>
          <p className="muted small" style={{ marginBottom: '1rem' }}>
            One click opens the free posting form on each board. Your description is pre-copied — just paste it.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <a
              className="btn ghost"
              href={`https://employers.indeed.com/p/post-job?co=US&l=${encodeURIComponent(form.location ?? '')}&jt=${encodeURIComponent(form.title ?? '')}`}
              target="_blank" rel="noreferrer"
            >
              📌 Post on Indeed (free)
            </a>
            <a
              className="btn ghost"
              href={`https://www.ziprecruiter.com/jobs/new?title=${encodeURIComponent(form.title ?? '')}&location=${encodeURIComponent(form.location ?? '')}`}
              target="_blank" rel="noreferrer"
            >
              📌 Post on ZipRecruiter
            </a>
            <a
              className="btn ghost"
              href={`https://www.glassdoor.com/employer/jobListing/jobListingAdd.htm`}
              target="_blank" rel="noreferrer"
            >
              📌 Post on Glassdoor
            </a>
            <a
              className="btn ghost"
              href={`https://www.google.com/search?q=${encodeURIComponent((form.title ?? '') + ' job posting site')}`}
              target="_blank" rel="noreferrer"
            >
              🔍 Google Jobs (auto via feed)
            </a>
          </div>
          <button
            className="btn primary small"
            onClick={() => {
              const desc = [
                form.title, form.client_company, form.location,
                form.salary_range ? `Salary: ${form.salary_range}` : '',
                '',
                form.description ?? '',
              ].filter((v) => v !== undefined && v !== '').join('\n')
              navigator.clipboard.writeText(desc).catch(() => null)
            }}
          >
            📋 Copy job description
          </button>
          <p className="muted small" style={{ marginTop: '0.5rem' }}>
            Your jobs also appear in the <strong>Indeed XML feed</strong> at{' '}
            <code style={{ fontSize: '0.78rem' }}>/feed/jobs.xml</code> — submit that URL to Indeed's{' '}
            <a href="https://indeed.com/publisher" target="_blank" rel="noreferrer">Publisher Program</a> for automatic indexing.
          </p>
        </div>
      )}

      {!creating && (
        <div className="form-card" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>AI Screening Questions</h2>
            <button className="btn primary small" onClick={onGenerateQuestions} disabled={qBusy}>
              {qBusy ? 'Generating…' : questions.length ? 'Regenerate' : '✦ Generate'}
            </button>
          </div>
          {qSource === 'fallback' && (
            <p className="muted small" style={{ marginBottom: '0.75rem' }}>AI not configured — showing default questions. Add <code>OPENAI_API_KEY</code> for role-specific questions.</p>
          )}
          {questions.length > 0 && (
            <>
              <ol className="screening-list">
                {questions.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
              <button className="btn ghost small" style={{ marginTop: '0.75rem' }} onClick={copyQuestions}>
                {copied ? '✓ Copied!' : 'Copy all'}
              </button>
            </>
          )}
          {questions.length === 0 && !qBusy && (
            <p className="muted small">Click Generate to create role-specific screening questions for this job order.</p>
          )}
        </div>
      )}

      {!creating && (
        <div className="form-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>AI Candidate Matching</h2>
            <button className="btn primary small" onClick={onFindMatches} disabled={matchBusy}>
              {matchBusy ? 'Matching…' : matches.length ? 'Re-match' : '✦ Find matches'}
            </button>
          </div>
          {matchNote && <p className="muted small" style={{ marginBottom: '0.75rem' }}>{matchNote}</p>}
          {matches.length > 0 && (
            <div className="match-list">
              {matches.map((m) => (
                <div key={m.candidate_id} className="match-card">
                  <div className="match-card__header">
                    <Link to={`/candidates/${m.candidate_id}`} className="match-card__name">{m.name}</Link>
                    <span className={`match-score match-score--${m.score >= 75 ? 'high' : m.score >= 50 ? 'mid' : 'low'}`}>{m.score}%</span>
                  </div>
                  {m.title && <p className="muted small" style={{ margin: '0.15rem 0' }}>{m.title}{m.location ? ` · ${m.location}` : ''}</p>}
                  {m.skills && <p className="muted small" style={{ margin: '0.15rem 0', fontSize: '0.8rem' }}>{m.skills}</p>}
                  <p className="match-card__reason">{m.reason}</p>
                </div>
              ))}
            </div>
          )}
          {matches.length === 0 && !matchBusy && (
            <p className="muted small">Click "Find matches" to rank your active candidates against this job order.</p>
          )}
        </div>
      )}
    </div>
  )
}
