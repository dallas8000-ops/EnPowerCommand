import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, listCandidates, listJobOrders, type Candidate, type JobOrder } from '../api'

type PlacementPrediction = { probability: number; factors: string[]; risks: string[] }

async function getFollowUpDraft(candidateId: string, context: string): Promise<{ draft: string }> {
  const res = await apiFetch('/api/ai/follow-up-draft', {
    method: 'POST', body: JSON.stringify({ candidate_id: candidateId, context }),
  })
  return res.json() as Promise<{ draft: string }>
}

async function getPlacementPrediction(candidateId: string, jobId: string): Promise<PlacementPrediction> {
  const res = await apiFetch('/api/ai/placement-prediction', {
    method: 'POST', body: JSON.stringify({ candidate_id: candidateId, job_order_id: jobId }),
  })
  return res.json() as Promise<PlacementPrediction>
}

async function getOfferLetter(candidateId: string, jobId: string, salary: string, startDate: string): Promise<{ letter: string }> {
  const res = await apiFetch('/api/ai/offer-letter', {
    method: 'POST', body: JSON.stringify({ candidate_id: candidateId, job_order_id: jobId, salary, start_date: startDate }),
  })
  return res.json() as Promise<{ letter: string }>
}

async function getDuplicates(): Promise<{ duplicates: { email: string; count: number; candidates: { id: string; name: string; created_at: string }[] }[] }> {
  const res = await apiFetch('/api/candidates/duplicates')
  return res.json() as Promise<{ duplicates: { email: string; count: number; candidates: { id: string; name: string; created_at: string }[] }[] }>
}

type Tab = 'follow-up' | 'predictor' | 'offer-letter' | 'duplicates'

export function AiToolsPage() {
  const [tab, setTab] = useState<Tab>('follow-up')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobs, setJobs] = useState<JobOrder[]>([])

  const [fuCandId, setFuCandId] = useState('')
  const [fuContext, setFuContext] = useState('')
  const [fuDraft, setFuDraft] = useState('')
  const [fuBusy, setFuBusy] = useState(false)
  const [fuCopied, setFuCopied] = useState(false)

  const [predCandId, setPredCandId] = useState('')
  const [predJobId, setPredJobId] = useState('')
  const [prediction, setPrediction] = useState<PlacementPrediction | null>(null)
  const [predBusy, setPredBusy] = useState(false)

  const [olCandId, setOlCandId] = useState('')
  const [olJobId, setOlJobId] = useState('')
  const [olSalary, setOlSalary] = useState('')
  const [olDate, setOlDate] = useState('')
  const [letter, setLetter] = useState('')
  const [olBusy, setOlBusy] = useState(false)
  const [olCopied, setOlCopied] = useState(false)

  const [duplicates, setDuplicates] = useState<{ email: string; count: number; candidates: { id: string; name: string; created_at: string }[] }[]>([])
  const [dupBusy, setDupBusy] = useState(false)
  const [dupLoaded, setDupLoaded] = useState(false)

  useEffect(() => {
    Promise.all([listCandidates(), listJobOrders()])
      .then(([cr, jr]) => { setCandidates(cr.candidates); setJobs(jr.job_orders) })
      .catch(() => null)
  }, [])

  async function onFollowUp() {
    setFuBusy(true); setFuDraft('')
    try { const r = await getFollowUpDraft(fuCandId, fuContext); setFuDraft(r.draft) }
    finally { setFuBusy(false) }
  }

  async function onPredict() {
    setPredBusy(true); setPrediction(null)
    try { const r = await getPlacementPrediction(predCandId, predJobId); setPrediction(r) }
    finally { setPredBusy(false) }
  }

  async function onOfferLetter() {
    setOlBusy(true); setLetter('')
    try { const r = await getOfferLetter(olCandId, olJobId, olSalary, olDate); setLetter(r.letter) }
    finally { setOlBusy(false) }
  }

  async function onLoadDuplicates() {
    setDupBusy(true)
    try { const r = await getDuplicates(); setDuplicates(r.duplicates); setDupLoaded(true) }
    finally { setDupBusy(false) }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'follow-up', label: 'Follow-up Drafts' },
    { id: 'predictor', label: 'Placement Predictor' },
    { id: 'offer-letter', label: 'Offer Letter' },
    { id: 'duplicates', label: 'Duplicate Finder' },
  ]

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <p className="eyebrow">AI Tools</p>
      <h1>AI Toolkit</h1>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? 'primary' : 'ghost'} small`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'follow-up' && (
        <div className="form-card">
          <h2>AI Follow-up Email Draft</h2>
          <p className="muted small" style={{ marginBottom: '1rem' }}>Generate a personalized cold outreach email for a candidate.</p>
          <div className="grid-form">
            <label className="full">
              Candidate
              <select value={fuCandId} onChange={(e) => setFuCandId(e.target.value)}>
                <option value="">— Select candidate —</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.title ? ` · ${c.title}` : ''}</option>)}
              </select>
            </label>
            <label className="full">
              Additional context (optional)
              <input value={fuContext} onChange={(e) => setFuContext(e.target.value)} placeholder="e.g. following up after LinkedIn view, 2nd touch…" />
            </label>
          </div>
          <div className="actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn primary" onClick={onFollowUp} disabled={fuBusy || !fuCandId}>
              {fuBusy ? 'Drafting…' : '✦ Generate draft'}
            </button>
          </div>
          {fuDraft && (
            <div style={{ marginTop: '1rem', background: 'var(--surface)', borderRadius: 8, padding: '0.85rem', fontFamily: 'inherit', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
              {fuDraft}
              <div style={{ marginTop: '0.6rem' }}>
                <button className="btn ghost small" onClick={() => { navigator.clipboard.writeText(fuDraft).catch(() => null); setFuCopied(true); setTimeout(() => setFuCopied(false), 2000) }}>
                  {fuCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'predictor' && (
        <div className="form-card">
          <h2>Placement Predictor</h2>
          <p className="muted small" style={{ marginBottom: '1rem' }}>AI estimates the likelihood of successfully placing a candidate in a specific role.</p>
          <div className="grid-form">
            <label>
              Candidate
              <select value={predCandId} onChange={(e) => setPredCandId(e.target.value)}>
                <option value="">— Select —</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              Job order
              <select value={predJobId} onChange={(e) => setPredJobId(e.target.value)}>
                <option value="">— Select —</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} @ {j.client_company}</option>)}
              </select>
            </label>
          </div>
          <div className="actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn primary" onClick={onPredict} disabled={predBusy || !predCandId || !predJobId}>
              {predBusy ? 'Analyzing…' : '✦ Predict placement'}
            </button>
          </div>
          {prediction && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '3rem', fontWeight: 700, color: prediction.probability >= 70 ? '#22c55e' : prediction.probability >= 45 ? '#f59e0b' : '#ef4444' }}>
                  {prediction.probability}%
                </div>
                <p className="muted small">placement probability</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ fontWeight: 600, color: '#22c55e', marginBottom: '0.4rem' }}>✓ Positive factors</p>
                  <ul style={{ paddingLeft: '1.2rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
                    {prediction.factors.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '0.4rem' }}>⚠ Risks</p>
                  <ul style={{ paddingLeft: '1.2rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
                    {prediction.risks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'offer-letter' && (
        <div className="form-card">
          <h2>AI Offer Letter Generator</h2>
          <p className="muted small" style={{ marginBottom: '1rem' }}>Draft a professional offer letter for a candidate placement.</p>
          <div className="grid-form">
            <label>
              Candidate
              <select value={olCandId} onChange={(e) => setOlCandId(e.target.value)}>
                <option value="">— Select —</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              Job order
              <select value={olJobId} onChange={(e) => setOlJobId(e.target.value)}>
                <option value="">— Select —</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} @ {j.client_company}</option>)}
              </select>
            </label>
            <label>
              Offered salary
              <input value={olSalary} onChange={(e) => setOlSalary(e.target.value)} placeholder="e.g. $85,000/yr" />
            </label>
            <label>
              Start date
              <input type="date" value={olDate} onChange={(e) => setOlDate(e.target.value)} />
            </label>
          </div>
          <div className="actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn primary" onClick={onOfferLetter} disabled={olBusy || !olCandId || !olJobId}>
              {olBusy ? 'Generating…' : '✦ Generate offer letter'}
            </button>
          </div>
          {letter && (
            <div style={{ marginTop: '1rem', background: 'var(--surface)', borderRadius: 8, padding: '0.85rem', fontFamily: 'inherit', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
              {letter}
              <div style={{ marginTop: '0.6rem' }}>
                <button className="btn ghost small" onClick={() => { navigator.clipboard.writeText(letter).catch(() => null); setOlCopied(true); setTimeout(() => setOlCopied(false), 2000) }}>
                  {olCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'duplicates' && (
        <div className="form-card">
          <h2>Duplicate Candidate Finder</h2>
          <p className="muted small" style={{ marginBottom: '1rem' }}>Find candidates sharing the same email address in your database.</p>
          <button className="btn primary" onClick={onLoadDuplicates} disabled={dupBusy}>
            {dupBusy ? 'Scanning…' : 'Scan for duplicates'}
          </button>
          {dupLoaded && duplicates.length === 0 && (
            <p className="muted" style={{ marginTop: '0.75rem' }}>No duplicates found. Your database is clean.</p>
          )}
          {duplicates.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {duplicates.map((d) => (
                <div key={d.email} style={{ padding: '0.7rem 0.9rem', background: 'var(--surface)', borderRadius: 8 }}>
                  <p style={{ fontWeight: 600 }}>{d.email} <span style={{ color: '#f59e0b', fontSize: '0.82rem' }}>({d.count} records)</span></p>
                  <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {d.candidates.map((c) => (
                      <Link key={c.id} to={`/candidates/${c.id}`} className="btn ghost small">{c.name} · {new Date(c.created_at).toLocaleDateString()}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
