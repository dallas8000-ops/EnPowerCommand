import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { loadProfile, saveProfile } from '../profile'

export function ProfilePage() {
  const [resumeText, setResumeText] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error'>('success')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    const p = loadProfile()
    setResumeText(p.resumeText)
    setSavedAt(p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '')
  }, [])

  useEffect(() => {
    if (!banner) return
    const ms = bannerTone === 'error' ? 12000 : 10000
    const t = window.setTimeout(() => setBanner(null), ms)
    return () => window.clearTimeout(t)
  }, [banner, bannerTone])

  function onSave(e: FormEvent) {
    e.preventDefault()
    try {
      const p = saveProfile({ resumeText })
      setSavedAt(new Date(p.updatedAt).toLocaleString())
      setBannerTone('success')
      setBanner(
        'Saved to this browser only (local storage). Open Import job — use “attach resume” there; refresh that page if the box was still disabled.'
      )
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 4000)
    } catch {
      setBannerTone('error')
      setBanner(
        'Could not save — this browser may block storage (private mode, full disk, or site settings). Try another browser or turn off strict tracking protection for this site.'
      )
    }
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
        {banner && (
          <div
            className={bannerTone === 'success' ? 'banner success' : 'banner error'}
            role="status"
            aria-live="polite"
          >
            {banner}
          </div>
        )}
        {savedAt && (
          <p className={`save-stamp ${justSaved ? 'save-stamp--flash' : ''}`}>
            Last saved: {savedAt}
          </p>
        )}
      </form>
    </div>
  )
}
