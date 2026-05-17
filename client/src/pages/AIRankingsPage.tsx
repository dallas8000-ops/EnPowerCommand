import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addToPipeline,
  getCandidateJobMatches,
  listCandidates,
  listJobOrders,
  type Candidate,
  type CandidateMatch,
  type JobMatch,
  type JobOrder,
} from '../api'

type Mode = 'job-to-candidates' | 'candidate-to-jobs'

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <span style={{
      display: 'inline-block', minWidth: 42, textAlign: 'center',
      padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700,
      background: color + '22', color,
    }}>{score}</span>
  )
}

async function fetchJobCandidates(jobId: string): Promise<{ matches: CandidateMatch[]; source: string }> {
  const res = await fetch(`/api/job-orders/${jobId}/matches`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('enpower_token') ?? ''}` },
  })
  return res.json() as Promise<{ matches: CandidateMatch[]; source: string }>
}

export function AIRankingsPage() {
  const [mode, setMode] = useState<Mode>('job-to-candidates')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [selectedJob, setSelectedJob] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [jobMatches, setJobMatches] = useState<CandidateMatch[]>([])
  const [candMatches, setCandMatches] = useState<JobMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<string>('')
  const [addMsg, setAddMsg] = useState<Record<string, string>>({})

  useEffect(() => {
    listCandidates().then((r) => setCandidates(r.candidates.filter((c) => c.status === 'active'))).catch(() => null)
    listJobOrders().then((r) => setJobOrders(r.job_orders.filter((j) => j.status === 'open'))).catch(() => null)
  }, [])

  async function onRank() {
    setLoading(true)
    setJobMatches([]); setCandMatches([]); setSource(''); setAddMsg({})
    try {
      if (mode === 'job-to-candidates' && selectedJob) {
        const r = await fetchJobCandidates(selectedJob)
        setJobMatches(r.matches); setSource(r.source)
      } else if (mode === 'candidate-to-jobs' && selectedCandidate) {
        const r = await getCandidateJobMatches(selectedCandidate)
        setCandMatches(r.matches); setSource(r.source)
      }
    } finally {
      setLoading(false)
    }
  }

  async function onAddToPipeline(candidateId: string, jobId: string, key: string) {
    try {
      await addToPipeline({ candidate_id: candidateId, job_order_id: jobId, stage: 'new' })
      setAddMsg((prev) => ({ ...prev, [key]: '✓ Added to pipeline' }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed'
      setAddMsg((prev) => ({ ...prev, [key]: msg }))
    }
  }

  const canRank = mode === 'job-to-candidates' ? !!selectedJob : !!selectedCandidate

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <p className="eyebrow">AI Tools</p>
      <h1>AI Rankings</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        Rank every candidate against a job, or find the best jobs for any candidate — across your entire talent pool.
      </p>

      <div className="form-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            className={`btn ${mode === 'job-to-candidates' ? 'primary' : 'ghost'}`}
            onClick={() => { setMode('job-to-candidates'); setJobMatches([]); setCandMatches([]) }}
          >
            Best candidates for a job
          </button>
          <button
            className={`btn ${mode === 'candidate-to-jobs' ? 'primary' : 'ghost'}`}
            onClick={() => { setMode('candidate-to-jobs'); setJobMatches([]); setCandMatches([]) }}
          >
            Best jobs for a candidate
          </button>
        </div>

        {mode === 'job-to-candidates' ? (
          <label>
            Select open job order
            <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
              <option value="">— Select a job —</option>
              {jobOrders.map((j) => (
                <option key={j.id} value={j.id}>{j.title} @ {j.client_company}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Select active candidate
            <select value={selectedCandidate} onChange={(e) => setSelectedCandidate(e.target.value)}>
              <option value="">— Select a candidate —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.title ? ` · ${c.title}` : ''}</option>
              ))}
            </select>
          </label>
        )}

        <div className="actions" style={{ marginTop: '0.75rem' }}>
          <button className="btn primary" onClick={onRank} disabled={loading || !canRank}>
            {loading ? '✦ Ranking with AI…' : '✦ Rank now'}
          </button>
        </div>
      </div>

      {source === 'fallback' && (
        <div className="banner error" style={{ marginBottom: '1rem' }}>AI not configured — showing unranked candidates. Set OPENAI_API_KEY to enable scoring.</div>
      )}

      {mode === 'job-to-candidates' && jobMatches.length > 0 && (
        <section>
          <h2>Top matches for <em>{jobOrders.find((j) => j.id === selectedJob)?.title}</em></h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            {jobMatches.map((m, idx) => {
              const key = `${m.candidate_id}-${selectedJob}`
              return (
                <div key={m.candidate_id} className="ranking-card">
                  <div className="ranking-card__rank">#{idx + 1}</div>
                  <div className="ranking-card__body">
                    <div className="ranking-card__header">
                      <Link to={`/candidates/${m.candidate_id}`} className="ranking-card__name">{m.name}</Link>
                      {m.title && <span className="muted small"> · {m.title}</span>}
                      <ScoreBadge score={m.score} />
                    </div>
                    {m.skills && <p className="muted small" style={{ margin: '0.2rem 0' }}>{m.skills}</p>}
                    <p className="ranking-card__reason">{m.reason}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                      <button
                        className="btn ghost small"
                        onClick={() => onAddToPipeline(m.candidate_id, selectedJob, key)}
                        disabled={!!addMsg[key]}
                      >
                        + Add to pipeline
                      </button>
                      {addMsg[key] && (
                        <span className="muted small" style={{ color: addMsg[key].startsWith('✓') ? '#22c55e' : '#f87171' }}>
                          {addMsg[key]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {mode === 'candidate-to-jobs' && candMatches.length > 0 && (
        <section>
          <h2>Best job matches for <em>{candidates.find((c) => c.id === selectedCandidate)?.name}</em></h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            {candMatches.map((m, idx) => {
              const key = `${selectedCandidate}-${m.job_id}`
              return (
                <div key={m.job_id} className="ranking-card">
                  <div className="ranking-card__rank">#{idx + 1}</div>
                  <div className="ranking-card__body">
                    <div className="ranking-card__header">
                      <Link to={`/job-orders/${m.job_id}`} className="ranking-card__name">{m.title}</Link>
                      <span className="muted small"> @ {m.client_company}</span>
                      <ScoreBadge score={m.score} />
                    </div>
                    {m.location && <p className="muted small" style={{ margin: '0.2rem 0' }}>📍 {m.location}</p>}
                    <p className="ranking-card__reason">{m.reason}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                      <button
                        className="btn ghost small"
                        onClick={() => onAddToPipeline(selectedCandidate, m.job_id, key)}
                        disabled={!!addMsg[key]}
                      >
                        + Add to pipeline
                      </button>
                      {addMsg[key] && (
                        <span className="muted small" style={{ color: addMsg[key].startsWith('✓') ? '#22c55e' : '#f87171' }}>
                          {addMsg[key]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {!loading && source && jobMatches.length === 0 && candMatches.length === 0 && (
        <p className="muted">No matches found. Make sure candidates have skills and job orders have descriptions.</p>
      )}
    </div>
  )
}
