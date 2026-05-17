import { useState } from 'react'
import { generateJobDescription } from '../api'

export function JdGeneratorPage() {
  const [form, setForm] = useState({ title: '', company: '', location: '', remote: false, salary_range: '', notes: '' })
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function set(field: string, val: string | boolean) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  async function onGenerate() {
    setBusy(true)
    setError(null)
    setResult('')
    try {
      const r = await generateJobDescription(form)
      if (r.description) setResult(r.description)
      else setError('No description returned.')
    } catch {
      setError('Failed to generate — check API connection.')
    } finally {
      setBusy(false)
    }
  }

  function copyResult() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function useAsDescription() {
    const params = new URLSearchParams({
      title: form.title,
      company: form.company,
      description: result,
    })
    window.location.href = `/job-orders/new?${params.toString()}`
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <p className="eyebrow">AI Tools</p>
      <h1>Job Description Generator</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>Enter a job title and company — AI writes a full job description you can copy or use directly.</p>

      <div className="form-card">
        <div className="grid-form">
          <label>
            Job title *
            <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Senior Software Engineer" />
          </label>
          <label>
            Company *
            <input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="e.g. Acme Corp" />
          </label>
          <label>
            Location
            <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Dallas, TX" />
          </label>
          <label>
            Salary / Rate range
            <input value={form.salary_range} onChange={(e) => set('salary_range', e.target.value)} placeholder="$80k–$100k" />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.remote} onChange={(e) => set('remote', e.target.checked)} />
            Remote position
          </label>
          <label className="full">
            Additional context
            <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Key skills, team size, industry, any other context…" />
          </label>
        </div>
        <div className="actions" style={{ marginTop: '1rem' }}>
          <button className="btn primary" onClick={onGenerate} disabled={busy || !form.title || !form.company}>
            {busy ? 'Generating…' : '✦ Generate job description'}
          </button>
        </div>
      </div>

      {error && <div className="banner error" style={{ marginTop: '1rem' }}>{error}</div>}

      {result && (
        <div className="form-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Generated description</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn ghost small" onClick={copyResult}>{copied ? '✓ Copied!' : 'Copy'}</button>
              <button className="btn primary small" onClick={useAsDescription}>Use in new job order →</button>
            </div>
          </div>
          <textarea
            rows={20}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.6 }}
          />
        </div>
      )}
    </div>
  )
}
