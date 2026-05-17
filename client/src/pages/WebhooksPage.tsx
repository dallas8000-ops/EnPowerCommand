import { useEffect, useState } from 'react'
import { createWebhook, deleteWebhook, getWebhooks, type WebhookEndpoint } from '../api'

const ALL_EVENTS = [
  'candidate.created', 'candidate.updated',
  'application.created', 'application.status_changed',
  'placement.created', 'interview.scheduled',
  'job_order.created', 'job_order.status_changed',
]

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['candidate.created', 'application.created', 'placement.created'])
  const [busy, setBusy] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)

  useEffect(() => {
    getWebhooks().then((r) => setWebhooks(r.webhooks)).finally(() => setLoading(false))
  }, [])

  function toggleEvent(ev: string) {
    setEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev])
  }

  async function onAdd() {
    if (!url) return
    setBusy(true)
    try {
      const r = await createWebhook({ url, events })
      setWebhooks((prev) => [...prev, r.webhook])
      setNewSecret(r.webhook.secret)
      setUrl(''); setShowForm(false)
    } finally { setBusy(false) }
  }

  async function onDelete(id: string) {
    if (!confirm('Remove this webhook endpoint?')) return
    await deleteWebhook(id)
    setWebhooks((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <p className="eyebrow">Integrations</p>
      <h1>Webhooks</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        Send real-time event notifications to your own endpoints or Zapier/Make.com. Each request includes an <code>X-RecruitCommand-Signature</code> HMAC-SHA256 header for verification.
      </p>

      {newSecret && (
        <div style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem', background: '#22c55e22', border: '1px solid #22c55e', borderRadius: 8 }}>
          <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Webhook created! Save your signing secret — it won't be shown again:</p>
          <code style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>{newSecret}</code>
          <button className="btn ghost small" style={{ marginLeft: '0.5rem' }} onClick={() => { navigator.clipboard.writeText(newSecret).catch(() => null) }}>Copy</button>
          <button className="btn ghost small" style={{ marginLeft: '0.4rem' }} onClick={() => setNewSecret(null)}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add endpoint'}
        </button>
      </div>

      {showForm && (
        <div className="form-card" style={{ marginBottom: '1.5rem' }}>
          <h2>New webhook endpoint</h2>
          <div className="grid-form">
            <label className="full">
              Endpoint URL
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/recruit" />
            </label>
            <label className="full">
              Events to subscribe
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                {ALL_EVENTS.map((ev) => (
                  <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.2rem 0.5rem', borderRadius: 4, background: events.includes(ev) ? 'var(--accent-bg)' : 'var(--surface)', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} style={{ margin: 0 }} />
                    {ev}
                  </label>
                ))}
              </div>
            </label>
          </div>
          <div className="actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn primary" onClick={onAdd} disabled={busy || !url || events.length === 0}>
              {busy ? 'Adding…' : 'Add endpoint'}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}
      {!loading && webhooks.length === 0 && !showForm && (
        <p className="muted">No webhook endpoints yet. Add one to receive real-time event notifications.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {webhooks.map((w) => (
          <div key={w.id} className="form-card" style={{ padding: '0.8rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, wordBreak: 'break-all', fontSize: '0.9rem' }}>{w.url}</p>
                <p className="muted small" style={{ marginTop: '0.25rem' }}>
                  {w.events.length > 0 ? w.events.join(' · ') : 'No events'}
                </p>
                <p className="muted small">Added {new Date(w.created_at).toLocaleDateString()}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, background: w.active ? '#22c55e22' : '#88888822', color: w.active ? '#22c55e' : '#888' }}>
                  {w.active ? 'active' : 'inactive'}
                </span>
                <button className="btn ghost small" style={{ color: '#f87171' }} onClick={() => onDelete(w.id)}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
