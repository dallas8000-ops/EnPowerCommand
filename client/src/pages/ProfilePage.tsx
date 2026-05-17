import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, getSmtpConfig, patchProfile, saveSmtpConfig, testSmtpConfig, type SmtpConfig } from '../api'
import { loadProfile, saveProfile } from '../profile'

export function ProfilePage() {
  const [resumeText, setResumeText] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error'>('success')
  const [justSaved, setJustSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [smtp, setSmtp] = useState<SmtpConfig | null>(null)
  const [smtpForm, setSmtpForm] = useState({ host: '', port: 587, secure: false, user_email: '', password: '', from_name: '' })
  const [smtpBusy, setSmtpBusy] = useState(false)
  const [smtpMsg, setSmtpMsg] = useState<{ text: string; ok: boolean } | null>(null)

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
    getSmtpConfig().then((r) => {
      if (r.config) {
        setSmtp(r.config)
        setSmtpForm((f) => ({ ...f, host: r.config!.host, port: r.config!.port, secure: r.config!.secure, user_email: r.config!.user_email, from_name: r.config!.from_name ?? '' }))
      }
    }).catch(() => null)
  }, [])

  async function onSaveSmtp() {
    setSmtpBusy(true); setSmtpMsg(null)
    try {
      await saveSmtpConfig({ ...smtpForm })
      setSmtpMsg({ text: 'SMTP settings saved.', ok: true })
      setSmtp({ host: smtpForm.host, port: smtpForm.port, secure: smtpForm.secure, user_email: smtpForm.user_email, from_name: smtpForm.from_name || null })
    } catch { setSmtpMsg({ text: 'Failed to save.', ok: false }) }
    finally { setSmtpBusy(false) }
  }

  async function onTestSmtp() {
    setSmtpBusy(true); setSmtpMsg(null)
    try {
      await testSmtpConfig()
      setSmtpMsg({ text: '✓ Connection successful!', ok: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Connection failed'
      setSmtpMsg({ text: msg, ok: false })
    }
    finally { setSmtpBusy(false) }
  }

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

      <div className="form-card" style={{ marginBottom: '2rem' }}>
        <h2>Email settings (SMTP)</h2>
        <p className="muted small" style={{ marginBottom: '1rem' }}>Connect your Gmail or Outlook to send emails to candidates directly from the app.</p>
        {smtp && <p className="muted small" style={{ marginBottom: '0.75rem' }}>Currently configured: <strong>{smtp.user_email}</strong></p>}
        <div className="grid-form">
          <label>
            SMTP host
            <input value={smtpForm.host} onChange={(e) => setSmtpForm((f) => ({ ...f, host: e.target.value }))} placeholder="smtp.gmail.com" />
          </label>
          <label>
            Port
            <input type="number" value={smtpForm.port} onChange={(e) => setSmtpForm((f) => ({ ...f, port: Number(e.target.value) }))} />
          </label>
          <label className="full">
            Email address
            <input type="email" value={smtpForm.user_email} onChange={(e) => setSmtpForm((f) => ({ ...f, user_email: e.target.value }))} placeholder="you@gmail.com" />
          </label>
          <label className="full">
            App password
            <input type="password" value={smtpForm.password} onChange={(e) => setSmtpForm((f) => ({ ...f, password: e.target.value }))} placeholder={smtp ? '(leave blank to keep existing)' : 'Gmail App Password or SMTP password'} />
          </label>
          <label className="full">
            Display name (optional)
            <input value={smtpForm.from_name} onChange={(e) => setSmtpForm((f) => ({ ...f, from_name: e.target.value }))} placeholder="Barney Gilliom — RecruitCommand" />
          </label>
          <div className="full checkbox-row">
            <input type="checkbox" id="smtp-secure" checked={smtpForm.secure} onChange={(e) => setSmtpForm((f) => ({ ...f, secure: e.target.checked }))} />
            <label htmlFor="smtp-secure" style={{ fontWeight: 'normal' }}>Use SSL (port 465 only — leave off for port 587)</label>
          </div>
        </div>
        {smtpMsg && <p className="muted small" style={{ marginTop: '0.5rem', color: smtpMsg.ok ? '#22c55e' : '#f87171' }}>{smtpMsg.text}</p>}
        <div className="actions" style={{ marginTop: '0.75rem' }}>
          <button className="btn primary" onClick={onSaveSmtp} disabled={smtpBusy || !smtpForm.host || !smtpForm.user_email}>{smtpBusy ? 'Saving…' : 'Save'}</button>
          {smtp && <button className="btn ghost" onClick={onTestSmtp} disabled={smtpBusy}>{smtpBusy ? 'Testing…' : 'Test connection'}</button>}
        </div>
        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          Gmail: use <strong>smtp.gmail.com</strong> port <strong>587</strong> + an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">App Password</a>.<br />
          Outlook: use <strong>smtp.office365.com</strong> port <strong>587</strong> + your email password.
        </p>
      </div>

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
