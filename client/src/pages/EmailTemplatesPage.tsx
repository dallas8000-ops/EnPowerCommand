import { useEffect, useState } from 'react'
import { createEmailTemplate, deleteEmailTemplate, getEmailTemplates, updateEmailTemplate, type EmailTemplate } from '../api'

export function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    getEmailTemplates().then((r) => setTemplates(r.templates)).finally(() => setLoading(false))
  }, [])

  function startEdit(t: EmailTemplate) {
    setEditing(t); setShowNew(false)
    setForm({ name: t.name, subject: t.subject, body: t.body })
  }

  function startNew() {
    setEditing(null); setShowNew(true)
    setForm({ name: '', subject: '', body: '' })
  }

  async function onSave() {
    if (!form.name || !form.subject || !form.body) return
    setBusy(true); setMsg(null)
    try {
      if (editing) {
        const r = await updateEmailTemplate(editing.id, form)
        setTemplates((prev) => prev.map((t) => t.id === editing.id ? r.template : t))
        setEditing(null)
      } else {
        const r = await createEmailTemplate(form)
        setTemplates((prev) => [...prev, r.template])
        setShowNew(false)
      }
      setForm({ name: '', subject: '', body: '' })
      setMsg('Saved.')
    } catch { setMsg('Failed to save.') }
    finally { setBusy(false) }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this template?')) return
    await deleteEmailTemplate(id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    if (editing?.id === id) setEditing(null)
  }

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <div>
          <p className="eyebrow">Email</p>
          <h1>Templates</h1>
        </div>
        <button className="btn primary" onClick={startNew}>+ New template</button>
      </div>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>Save reusable email drafts. Use them when composing emails to candidates.</p>

      {(showNew || editing) && (
        <div className="form-card" style={{ marginBottom: '1.5rem' }}>
          <h2>{editing ? 'Edit template' : 'New template'}</h2>
          <div className="grid-form">
            <label className="full">
              Template name
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Initial outreach, Interview confirmation…" />
            </label>
            <label className="full">
              Subject line
              <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject…" />
            </label>
            <label className="full">
              Body
              <textarea rows={8} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Hi {{name}}, I wanted to reach out about an opportunity…" />
            </label>
          </div>
          {msg && <p className="muted small" style={{ marginTop: '0.5rem', color: msg === 'Saved.' ? '#22c55e' : '#f87171' }}>{msg}</p>}
          <div className="actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn primary" onClick={onSave} disabled={busy || !form.name || !form.subject || !form.body}>
              {busy ? 'Saving…' : 'Save template'}
            </button>
            <button className="btn ghost" onClick={() => { setEditing(null); setShowNew(false) }}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}
      {!loading && templates.length === 0 && !showNew && (
        <p className="muted">No templates yet. Create one above to save time on repetitive emails.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {templates.map((t) => (
          <div key={t.id} className="form-card" style={{ padding: '0.8rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600 }}>{t.name}</p>
                <p className="muted small">{t.subject}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn ghost small" onClick={() => startEdit(t)}>Edit</button>
                <button className="btn ghost small" style={{ color: '#f87171' }} onClick={() => onDelete(t.id)}>Delete</button>
              </div>
            </div>
            <p className="muted small" style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>{t.body.slice(0, 120)}{t.body.length > 120 ? '…' : ''}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
