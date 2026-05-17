import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicJobById, type PublicJob } from '../api'

async function submitApplication(jobId: string, body: {
  name: string; email: string; phone: string; location: string; resume_text: string; cover_letter: string;
}): Promise<void> {
  const res = await fetch(`/api/public/jobs/${jobId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json() as { error?: string }
    throw new Error(data.error ?? 'Application failed')
  }
}

export function JobApplyPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', resume_text: '', cover_letter: '' })

  useEffect(() => {
    if (!id) return
    getPublicJobById(id)
      .then((r) => setJob(r.job))
      .catch(() => setJob(null))
      .finally(() => setLoading(false))
  }, [id])

  function set(field: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  async function onSubmit() {
    if (!id || !form.name || !form.email) return
    setBusy(true); setError(null)
    try {
      await submitApplication(id, form)
      setSubmitted(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    } finally { setBusy(false) }
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>
  if (!job) return <div className="page"><p className="muted">Job not found or no longer accepting applications.</p></div>

  if (submitted) {
    return (
      <div className="page" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h1>Application submitted!</h1>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Thank you for applying for <strong>{job.title}</strong> at <strong>{job.client_company}</strong>.
          We'll be in touch shortly.
        </p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <p className="eyebrow">Application</p>
      <h1>{job.title}</h1>
      <p className="muted" style={{ marginBottom: '0.25rem' }}>
        {job.client_company}{job.location ? ` · ${job.location}` : ''}{job.remote ? ' · Remote' : ''}
      </p>
      {job.salary_range && <p className="muted small">💰 {job.salary_range}</p>}

      {job.description && (
        <div className="form-card" style={{ margin: '1.25rem 0', fontSize: '0.9rem', lineHeight: 1.65 }}>
          <h2 style={{ marginBottom: '0.6rem' }}>About this role</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{job.description}</p>
        </div>
      )}

      <div className="form-card">
        <h2>Apply now</h2>
        {error && <div className="banner error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
        <div className="grid-form">
          <label className="full">
            Full name *
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Smith" required />
          </label>
          <label>
            Email *
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@email.com" required />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
          </label>
          <label className="full">
            Location
            <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City, State" />
          </label>
          <label className="full">
            Resume / experience
            <textarea rows={8} value={form.resume_text} onChange={(e) => set('resume_text', e.target.value)} placeholder="Paste your resume or summarize your experience, skills, and background…" />
          </label>
          <label className="full">
            Cover letter (optional)
            <textarea rows={4} value={form.cover_letter} onChange={(e) => set('cover_letter', e.target.value)} placeholder="Why are you a great fit for this role?" />
          </label>
        </div>
        <div className="actions" style={{ marginTop: '1rem' }}>
          <button className="btn primary" onClick={onSubmit} disabled={busy || !form.name || !form.email}>
            {busy ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </div>
    </div>
  )
}
