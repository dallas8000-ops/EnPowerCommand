import { useState } from 'react'
import { Link } from 'react-router-dom'
import { submitPublicJob } from '../api'

type Field = {
  client_company: string
  title: string
  location: string
  remote: boolean
  salary_range: string
  description: string
  client_contact_name: string
  client_contact_email: string
  client_notes: string
}

const empty: Field = {
  client_company: '',
  title: '',
  location: '',
  remote: false,
  salary_range: '',
  description: '',
  client_contact_name: '',
  client_contact_email: '',
  client_notes: '',
}

export function PostJobPage() {
  const [form, setForm] = useState<Field>(empty)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof Field, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await submitPublicJob(form)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="page">
        <div className="empty-state" style={{ paddingTop: '5rem' }}>
          <p className="empty-state__icon">✅</p>
          <p className="empty-state__title">Submission received!</p>
          <p className="empty-state__desc">
            We'll review your opening and reach out within 1 business day.
          </p>
          <Link className="btn primary" to="/jobs">Back to job board</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <p className="eyebrow">Client Portal</p>
      <h1>Post a job opening</h1>
      <p className="lede" style={{ marginBottom: '1.75rem' }}>
        Tell us about the role you need filled. We'll review your submission and reach out within 1 business day.
      </p>

      {error && <div className="banner error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-card">
          <h2>Company &amp; role</h2>
          <div className="form-grid">
            <label>
              Company name *
              <input required value={form.client_company} onChange={(e) => set('client_company', e.target.value)} placeholder="Acme Corp" />
            </label>
            <label>
              Job title *
              <input required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Senior Software Engineer" />
            </label>
            <label>
              Location
              <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Austin, TX" />
            </label>
            <label>
              Salary / comp range
              <input value={form.salary_range} onChange={(e) => set('salary_range', e.target.value)} placeholder="$120k – $150k" />
            </label>
            <label className="checkbox-row" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={form.remote} onChange={(e) => set('remote', e.target.checked)} />
              Remote / hybrid role
            </label>
          </div>
        </div>

        <div className="form-card">
          <h2>Role details</h2>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <label style={{ gridColumn: '1 / -1' }}>
              Job description
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Describe the role, responsibilities, and required skills…"
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Additional notes for our team
              <textarea
                rows={3}
                value={form.client_notes}
                onChange={(e) => set('client_notes', e.target.value)}
                placeholder="Timeline, ideal start date, must-haves, deal-breakers…"
              />
            </label>
          </div>
        </div>

        <div className="form-card">
          <h2>Your contact info</h2>
          <div className="form-grid">
            <label>
              Your name *
              <input required value={form.client_contact_name} onChange={(e) => set('client_contact_name', e.target.value)} placeholder="Jane Smith" />
            </label>
            <label>
              Your email *
              <input required type="email" value={form.client_contact_email} onChange={(e) => set('client_contact_email', e.target.value)} placeholder="jane@acmecorp.com" />
            </label>
          </div>
        </div>

        <div className="actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit opening'}
          </button>
          <Link className="btn ghost" to="/jobs">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
