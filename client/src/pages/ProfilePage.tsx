import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, patchProfile } from '../api'
import { loadProfile, saveProfile } from '../profile'

export function ProfilePage() {
  const [resumeText, setResumeText] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error'>('success')
  const [justSaved, setJustSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const remote = await getProfile()
        if (cancelled) return
        if (remote.resume_text?.trim()) {
          setResumeText(remote.resume_text)
          setSavedAt(
            remote.updated_at ? new Date(remote.updated_at).toLocaleString() : ''
          )
        } else {
          const local = loadProfile()
          if (local.resumeText.trim()) {
            setResumeText(local.resumeText)
            try {
              await patchProfile(local.resumeText)
              const again = await getProfile()
              if (again.updated_at) {
                setSavedAt(new Date(again.updated_at).toLocaleString())
              }
              setBannerTone('success')
              setBanner('Copied your browser profile into the database (one-time migration).')
            } catch {
              setResumeText(local.resumeText)
            }
          }
        }
      } catch {
        const local = loadProfile()
        if (!cancelled) {
          setResumeText(local.resumeText)
          setSavedAt(
            local.updatedAt ? new Date(local.updatedAt).toLocaleString() : ''
          )
          setBannerTone('error')
          setBanner('Could not load server profile — showing browser copy only. Save will try both.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!banner) return
    const ms = bannerTone === 'error' ? 12000 : 10000
    const t = window.setTimeout(() => setBanner(null), ms)
    return () => window.clearTimeout(t)
  }, [banner, bannerTone])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setJustSaved(false)
    try {
      await patchProfile(resumeText)
      saveProfile({ resumeText })
      const remote = await getProfile()
      setSavedAt(
        remote.updated_at ? new Date(remote.updated_at).toLocaleString() : ''
      )
      setBannerTone('success')
      setBanner(
        'Saved to the database and mirrored in this browser. Use Import / Generate outreach from any device after you sign in.'
      )
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 4000)
    } catch {
      try {
        saveProfile({ resumeText })
        const p = loadProfile()
        setSavedAt(new Date(p.updatedAt).toLocaleString())
        setBannerTone('error')
        setBanner(
          'Server save failed — kept a copy in this browser only. Check login and API logs.'
        )
      } catch {
        setBannerTone('error')
        setBanner('Could not save anywhere — check browser storage and API.')
      }
    }
  }

  if (loading) {
    return (
      <div className="page stretch">
        <p className="muted">Loading profile…</p>
      </div>
    )
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
        Resume text is stored in the <strong>database</strong> (after you sign in when the API
        requires it) and <strong>mirrored</strong> in this browser for offline fallback. Used for
        job import and outreach drafts.
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
