import { useState } from 'react'
import { apiFetch } from '../api'

type ImportRow = { name: string; email: string; phone: string; title: string; location: string; skills: string; notes: string }
type ImportResult = { name: string; id?: string; error?: string }

const EMPTY_ROW: ImportRow = { name: '', email: '', phone: '', title: '', location: '', skills: '', notes: '' }
const FIELDS: { key: keyof ImportRow; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Name *', placeholder: 'Full name' },
  { key: 'email', label: 'Email', placeholder: 'email@example.com' },
  { key: 'phone', label: 'Phone', placeholder: '+1 555 000 0000' },
  { key: 'title', label: 'Title', placeholder: 'Software Engineer' },
  { key: 'location', label: 'Location', placeholder: 'City, State' },
  { key: 'skills', label: 'Skills', placeholder: 'React, Node.js…' },
  { key: 'notes', label: 'Notes', placeholder: 'Any extra info' },
]

async function bulkImport(candidates: ImportRow[]): Promise<{ results: ImportResult[] }> {
  const res = await apiFetch('/api/candidates/bulk-import', { method: 'POST', body: JSON.stringify({ candidates }) })
  return res.json() as Promise<{ results: ImportResult[] }>
}

export function BulkImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([{ ...EMPTY_ROW }])
  const [results, setResults] = useState<ImportResult[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  function setRow(i: number, field: keyof ImportRow, val: string) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  function addRow() {
    if (rows.length >= 10) return
    setRows((prev) => [...prev, { ...EMPTY_ROW }])
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function onImport() {
    const valid = rows.filter((r) => r.name.trim())
    if (valid.length === 0) return
    setBusy(true); setDone(false)
    try {
      const r = await bulkImport(valid)
      setResults(r.results)
      setDone(true)
      setRows([{ ...EMPTY_ROW }])
    } finally { setBusy(false) }
  }

  const successCount = results.filter((r) => r.id).length
  const errorCount = results.filter((r) => r.error).length

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <p className="eyebrow">Candidates</p>
      <h1>Bulk Resume Import</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>Import up to 10 candidates at once. Fill in each row and click Import.</p>

      {done && (
        <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: 8, background: successCount > 0 ? '#22c55e22' : '#f8717122', border: `1px solid ${successCount > 0 ? '#22c55e' : '#f87171'}` }}>
          <p style={{ fontWeight: 600 }}>{successCount} imported successfully{errorCount > 0 ? `, ${errorCount} failed` : ''}</p>
          {results.map((r, i) => (
            <p key={i} className="muted small">{r.name}: {r.id ? '✓ Added' : `✗ ${r.error ?? 'Failed'}`}</p>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              {FIELDS.map((f) => (
                <th key={f.key} style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-muted)' }}>{f.label}</th>
              ))}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {FIELDS.map((f) => (
                  <td key={f.key} style={{ padding: '0.3rem 0.4rem' }}>
                    <input
                      value={row[f.key]}
                      onChange={(e) => setRow(i, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit' }}
                    />
                  </td>
                ))}
                <td style={{ padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions" style={{ marginTop: '1rem' }}>
        {rows.length < 10 && (
          <button className="btn ghost small" onClick={addRow}>+ Add row ({rows.length}/10)</button>
        )}
        <button className="btn primary" onClick={onImport} disabled={busy || rows.every((r) => !r.name.trim())}>
          {busy ? 'Importing…' : `Import ${rows.filter((r) => r.name.trim()).length} candidate${rows.filter((r) => r.name.trim()).length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
