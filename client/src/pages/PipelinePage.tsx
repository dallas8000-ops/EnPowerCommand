import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getPipeline,
  patchPlacement,
  removePlacement,
  type Placement,
} from '../api'

const STAGES = ['sourced', 'screening', 'submitted', 'interview', 'offer', 'placed', 'rejected'] as const
type Stage = typeof STAGES[number]

const STAGE_LABELS: Record<Stage, string> = {
  sourced: 'Sourced',
  screening: 'Screening',
  submitted: 'Submitted',
  interview: 'Interview',
  offer: 'Offer',
  placed: 'Placed ✓',
  rejected: 'Rejected',
}

export function PipelinePage() {
  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Placement | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getPipeline()
      .then((r) => setPlacements(r.placements))
      .finally(() => setLoading(false))
  }, [])

  const byStage = Object.fromEntries(
    STAGES.map((s) => [s, placements.filter((p) => p.stage === s)])
  ) as Record<Stage, Placement[]>

  async function moveStage(placement: Placement, stage: Stage) {
    setBusy(true)
    const r = await patchPlacement(placement.id, { stage })
    if (r.placement) {
      setPlacements((prev) => prev.map((p) => (p.id === r.placement!.id ? { ...p, stage: r.placement!.stage } : p)))
      if (selected?.id === placement.id) setSelected((s) => s ? { ...s, stage } : s)
    }
    setBusy(false)
  }

  async function onRemove(placement: Placement) {
    if (!confirm(`Remove ${placement.candidate.name} from this pipeline?`)) return
    await removePlacement(placement.id)
    setPlacements((prev) => prev.filter((p) => p.id !== placement.id))
    if (selected?.id === placement.id) setSelected(null)
  }

  const totalPlaced = placements.filter((p) => p.stage === 'placed').length
  const totalActive = placements.filter((p) => !['placed', 'rejected'].includes(p.stage)).length

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div className="page-header">
        <h1>Pipeline</h1>
        <p className="muted small">
          {placements.length} placements · {totalActive} active · {totalPlaced} placed
        </p>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && placements.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">🔄</div>
          <p className="empty-state__title">Pipeline is empty</p>
          <p className="empty-state__desc">Add candidates to job orders to start tracking placements.</p>
          <button className="btn primary" onClick={() => navigate('/candidates')}>Go to candidates</button>
        </div>
      )}

      {!loading && placements.length > 0 && (
        <div className="kanban-board">
          {STAGES.map((stage) => (
            <div key={stage} className="kanban-col">
              <div className="kanban-col__header">
                <span>{STAGE_LABELS[stage]}</span>
                <span className="kanban-col__count">{byStage[stage].length}</span>
              </div>
              <div className="kanban-col__body">
                {byStage[stage].map((p) => (
                  <div
                    key={p.id}
                    className="kanban-card"
                    onClick={() => setSelected(selected?.id === p.id ? null : p)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(selected?.id === p.id ? null : p)}
                    aria-pressed={selected?.id === p.id}
                    style={selected?.id === p.id ? { borderColor: '#7c3aed' } : undefined}
                  >
                    <div className="kanban-card__name">{p.candidate.name}</div>
                    <div className="kanban-card__meta">{p.job_order.title} · {p.job_order.client_company}</div>
                    {p.candidate.title && (
                      <div className="kanban-card__meta" style={{ marginTop: '0.15rem' }}>{p.candidate.title}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="form-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-h)' }}>{selected.candidate.name}</h2>
              <p className="muted small" style={{ margin: '0.15rem 0 0' }}>
                {selected.job_order.title} @ {selected.job_order.client_company}
              </p>
            </div>
            <button
              className="btn ghost"
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>

          <p className="muted small" style={{ marginBottom: '0.75rem' }}>Move to stage:</p>
          <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
            {STAGES.map((s) => (
              <button
                key={s}
                className={`filter-tab${selected.stage === s ? ' active' : ''}`}
                onClick={() => moveStage(selected, s)}
                disabled={busy || selected.stage === s}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={() => navigate(`/candidates/${selected.candidate.id}`)}>
              View candidate →
            </button>
            <button className="btn secondary" onClick={() => navigate(`/job-orders/${selected.job_order.id}`)}>
              View job order →
            </button>
            <button className="btn ghost" style={{ color: '#f87171', marginLeft: 'auto' }} onClick={() => onRemove(selected)}>
              Remove from pipeline
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
