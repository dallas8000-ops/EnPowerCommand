import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createLeadFromPosting } from '../api'
import { hasResumeText, loadProfile } from '../profile'

export function ImportLeadPage() {
  const navigate = useNavigate()
  const [rawPosting, setRawPosting] = useState('')
  const [companyHint, setCompanyHint] = useState('')
  const [url, setUrl] = useState('')
  const [attachResume, setAttachResume] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    setHasProfile(hasResumeText())
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setBanner(null)
    const profile = loadProfile()
    const resume_context =
      attachResume && profile.resumeText.trim() ? profile.resumeText : undefined
    const r = await createLeadFromPosting({
      raw_posting: rawPosting,
      resume_context,
      company_hint: companyHint.trim() || undefined,
      url: url.trim() || undefined,
    })
    setBusy(false)
    if (r.lead?.id) {
      navigate(`/leads/${r.lead.id}`)
      return
    }
    setBanner(
      typeof r.error === 'object' && r.error && 'formErrors' in (r.error as object)
        ? 'Check pasted text length and try again.'
        : 'Could not create lead. Is the API running and DATABASE_URL set?'
    )
  }

  return (
    <div className="page stretch">
      <header className="page-head">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>Import from job posting</h1>
        </div>
        <Link className="btn ghost" to="/leads">
          Back
        </Link>
      </header>

      <p className="lede">
        Paste text from LinkedIn, Indeed, or the employer&apos;s careers page (you don&apos;t need
        the whole page — role + requirements + apply link is enough). Optional: company name and job
        URL. If{' '}
        <Link to="/profile">your resume profile</Link> is filled in, we attach it so AI can infer
        fit (with <code>OPENAI_API_KEY</code> on the server).
      </p>

      {!hasProfile && (
        <div className="banner">
          Tip: add your resume on the{' '}
          <Link to="/profile">Profile</Link> page so imports and outreach can use it.
        </div>
      )}

      {banner && <div className="banner">{banner}</div>}

      <form className="grid-form" onSubmit={onSubmit}>
        <label className="full">
          Job posting (paste) *
          <textarea
            required
            minLength={30}
            rows={14}
            placeholder="Paste title, requirements, stack, location, how to apply…"
            value={rawPosting}
            onChange={(e) => setRawPosting(e.target.value)}
          />
        </label>
        <label>
          Company hint
          <input
            value={companyHint}
            onChange={(e) => setCompanyHint(e.target.value)}
            placeholder="Acme Inc."
          />
        </label>
        <label>
          Job URL
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… or careers.acme.com/…"
          />
        </label>
        <label className="full checkbox-row">
          <input
            type="checkbox"
            checked={attachResume}
            onChange={(e) => setAttachResume(e.target.checked)}
            disabled={!hasProfile}
          />
          <span>
            Attach saved resume profile to this import ({hasProfile ? 'available' : 'add one first'})
          </span>
        </label>
        <div className="full actions-inline">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create lead'}
          </button>
        </div>
      </form>
    </div>
  )
}
