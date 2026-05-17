import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createJobOrder, deleteJobOrder, getJobOrder, patchJobOrder, type JobOrder } from '../api'

export function JobOrderEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const creating = id === 'new'

  const [form, setForm] = useState<Partial<JobOrder>>({ status: 'open', remote: false })
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!creating)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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
    </div>
  )
}
