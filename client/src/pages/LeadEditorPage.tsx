import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createLead,
  generateOutreach,
  getLead,
  patchLead,
  type Lead,
  type OutreachResult,
} from '../api'
import { loadProfile } from '../profile'

const stages = ['new', 'contacted', 'call', 'proposal', 'won', 'lost']

export function LeadEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [lead, setLead] = useState<Partial<Lead>>({
    company: '',
    contact_name: '',
    role: '',
    url: '',
    notes: '',
    stage: 'new',
  })
  const [saving, setSaving] = useState(false)
  const [outreach, setOutreach] = useState<OutreachResult | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    if (isNew || !id) return
    getLead(id).then((r) => {
      if (r.lead) {
        setLead({
          ...r.lead,
          contact_name: r.lead.contact_name ?? '',
          role: r.lead.role ?? '',
          url: r.lead.url ?? '',
          notes: r.lead.notes ?? '',
        })
      } else {
        setBanner('Lead not found')
      }
    })
  }, [id, isNew])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setBanner(null)
    try {
      if (isNew) {
        const r = await createLead({
          company: lead.company ?? '',
          contact_name: lead.contact_name || null,
          role: lead.role || null,
          url: lead.url || null,
          notes: lead.notes || null,
          stage: lead.stage ?? 'new',
        })
        if (r.lead) navigate(`/leads/${r.lead.id}`, { replace: true })
        else setBanner('Could not create lead')
      } else if (id) {
        const r = await patchLead(id, {
          company: lead.company,
          contact_name: lead.contact_name || null,
          role: lead.role || null,
          url: lead.url || null,
          notes: lead.notes || null,
          stage: lead.stage,
        })
        if (r.lead) setLead({ ...r.lead, contact_name: r.lead.contact_name ?? '' })
        else setBanner('Could not save')
      }
    } finally {
      setSaving(false)
    }
  }

  async function onGenerate() {
    setLoadingAi(true)
    setOutreach(null)
    setBanner(null)
    try {
      const resume = loadProfile().resumeText.trim()
      const res = await generateOutreach(
        isNew
          ? {
              company: lead.company ?? '',
              contact_name: lead.contact_name || null,
              role: lead.role || null,
              url: lead.url || null,
              notes: lead.notes || null,
              resume_context: resume || undefined,
            }
          : { lead_id: id!, resume_context: resume || undefined }
      )
      if (res.status >= 400) {
        setBanner(res.error ?? 'Outreach failed')
      }
      setOutreach(res)
    } finally {
      setLoadingAi(false)
    }
  }

  return (
    <div className="page stretch">
      <header className="page-head">
        <div>
          <p className="eyebrow">{isNew ? 'New' : 'Edit'}</p>
          <h1>{isNew ? 'Add lead' : lead.company || 'Lead'}</h1>
        </div>
        <Link className="btn ghost" to="/leads">
          Back
        </Link>
      </header>

      {banner && <div className="banner error">{banner}</div>}

      <form className="grid-form" onSubmit={onSubmit}>
        <label>
          Company *
          <input
            required
            value={lead.company ?? ''}
            onChange={(e) => setLead({ ...lead, company: e.target.value })}
          />
        </label>
        <label>
          Contact name
          <input
            value={lead.contact_name ?? ''}
            onChange={(e) => setLead({ ...lead, contact_name: e.target.value })}
          />
        </label>
        <label>
          Role / title
          <input
            value={lead.role ?? ''}
            onChange={(e) => setLead({ ...lead, role: e.target.value })}
          />
        </label>
        <label>
          URL
          <input
            placeholder="https://"
            value={lead.url ?? ''}
            onChange={(e) => setLead({ ...lead, url: e.target.value })}
          />
        </label>
        <label className="full">
          Notes (pain, stack, posting, etc.)
          <textarea
            rows={4}
            value={lead.notes ?? ''}
            onChange={(e) => setLead({ ...lead, notes: e.target.value })}
          />
        </label>
        <label>
          Stage
          <select
            value={lead.stage ?? 'new'}
            onChange={(e) => setLead({ ...lead, stage: e.target.value })}
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="full actions-inline">
          <button className="btn primary" type="submit" disabled={saving}>
            {isNew ? 'Create lead' : 'Save'}
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={onGenerate}
            disabled={loadingAi || (!isNew ? false : !(lead.company ?? '').trim())}
          >
            {loadingAi ? 'Generating…' : 'Generate outreach'}
          </button>
        </div>
      </form>

      {outreach && (
        <section className="outreach">
          <h2>Drafts</h2>
          {outreach.disclaimer && <p className="muted small">{outreach.disclaimer}</p>}
          {outreach.model && <p className="muted small">Model: {outreach.model}</p>}
          <div className="subjects">
            <h3>Subject lines</h3>
            <ul>
              {outreach.subject_lines?.map((s, i) => (
                <li key={i}>
                  <code>{s}</code>
                </li>
              ))}
            </ul>
          </div>
          {outreach.drafts?.map((d, i) => (
            <article key={i} className="draft-card">
              <header>{d.label}</header>
              <pre>{d.body}</pre>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
