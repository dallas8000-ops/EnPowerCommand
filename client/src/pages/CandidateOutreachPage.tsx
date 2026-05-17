import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { draftCandidateOutreach, listCandidates, listJobOrders, type Candidate, type JobOrder } from '../api'

export function CandidateOutreachPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [candidateId, setCandidateId] = useState('')
  const [jobOrderId, setJobOrderId] = useState('')
  const [tone, setTone] = useState<'professional' | 'friendly' | 'concise'>('professional')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    listCandidates().then((r) => setCandidates(r.candidates.filter((c) => c.status === 'active'))).catch(() => null)
    listJobOrders().then((r) => setJobOrders(r.job_orders.filter((j) => j.status === 'open'))).catch(() => null)
  }, [])

  async function onDraft() {
    if (!candidateId || !jobOrderId) return
    setBusy(true)
    setError(null)
    setEmail('')
    try {
      const r = await draftCandidateOutreach({ candidate_id: candidateId, job_order_id: jobOrderId, tone })
      setEmail(r.email)
    } catch {
      setError('Failed to generate email — check API connection.')
    } finally {
      setBusy(false)
    }
  }

  function copyEmail() {
    navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <p className="eyebrow">AI Tools</p>
      <h1>Candidate Outreach Email</h1>
      <p className="muted" style={{ marginBottom: '0.75rem' }}>Select a candidate and job order — AI drafts a personalized email you can send directly.</p>
      <div className="actions" style={{ marginBottom: '1.5rem' }}>
        <Link className="btn ghost small" to="/ai/jd-generator">JD Generator</Link>
      </div>

      <div className="form-card">
        <div className="grid-form">
          <label className="full">
            Candidate *
            <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
              <option value="">— Select a candidate —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.title ? ` · ${c.title}` : ''}</option>
              ))}
            </select>
          </label>
          <label className="full">
            Job order *
            <select value={jobOrderId} onChange={(e) => setJobOrderId(e.target.value)}>
              <option value="">— Select a job order —</option>
              {jobOrders.map((j) => (
                <option key={j.id} value={j.id}>{j.title} @ {j.client_company}</option>
              ))}
            </select>
          </label>
          <label>
            Tone
            <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </select>
          </label>
        </div>
        <div className="actions" style={{ marginTop: '1rem' }}>
          <button className="btn primary" onClick={onDraft} disabled={busy || !candidateId || !jobOrderId}>
            {busy ? 'Drafting…' : '✦ Draft email'}
          </button>
        </div>
      </div>

      {error && <div className="banner error" style={{ marginTop: '1rem' }}>{error}</div>}

      {email && (
        <div className="form-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Drafted email</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn ghost small" onClick={copyEmail}>{copied ? '✓ Copied!' : 'Copy'}</button>
              <button className="btn primary small" onClick={onDraft} disabled={busy}>Regenerate</button>
            </div>
          </div>
          <textarea
            rows={14}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.65 }}
          />
          <p className="muted small" style={{ marginTop: '0.5rem' }}>You can edit the email above before copying.</p>
        </div>
      )}
    </div>
  )
}
