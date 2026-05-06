import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { loadProfile, saveProfile } from '../profile'

export function ProfilePage() {
  const [resumeText, setResumeText] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    const p = loadProfile()
    setResumeText(p.resumeText)
    setSavedAt(p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '')
  }, [])

  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 8000)
    return () => window.clearTimeout(t)
  }, [banner])

  function onSave(e: FormEvent) {
    e.preventDefault()
    const p = saveProfile({ resumeText })
    setSavedAt(new Date(p.updatedAt).toLocaleString())
    setBanner(
      'Saved to this browser (local storage). On Import job, “attach resume” should be available — refresh that page if needed.'
    )
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 2500)
  }

  return (
    <div className="page stretch">
      <header className="page-head">
        <div>
          <p className="eyebrow">Your data</p>
          <h1>Resume profile</h1>
        </div>
        <Link className="btn ghost" to="/leads/import">
          Import a job
        </Link>
      </header>

      <p className="lede">
        Paste your resume or a tight summary (skills, stacks, 3 wins). It stays in{' '}
        <strong>browser storage only</strong> — used when you import job postings and generate
        outreach so drafts can cite relevant proof points.
      </p>

      {banner && (
        <div className="banner success" role="status" aria-live="polite">
          {banner}
        </div>
      )}
      {savedAt && <p className="muted small">Last saved: {savedAt}</p>}

      <form className="grid-form" onSubmit={onSave}>
        <label className="full">
          Resume / highlights
          <textarea
            rows={18}
            placeholder="Paste resume text, or bullet summary: React, Node, Postgres, CI/CD, shipped X…"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />
        </label>
        <div className="full actions-inline">
          <button className="btn primary" type="submit">
            {justSaved ? 'Saved ✓' : 'Save profile'}
          </button>
          <Link className="btn ghost" to="/leads">
            Leads
          </Link>
        </div>
      </form>
    </div>
  )
}
