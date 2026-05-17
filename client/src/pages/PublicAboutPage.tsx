import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type AboutData = {
  agency_name: string
  tagline: string | null
  bio: string | null
  specialties: string | null
  headshot_url: string | null
  contact_email: string | null
  contact_phone: string | null
  linkedin_url: string | null
  website_url: string | null
}

export function PublicAboutPage() {
  const [data, setData] = useState<AboutData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/public/about')
      .then((r) => r.ok ? r.json() : null)
      .then((d: { about: AboutData } | null) => setData(d?.about ?? null))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page" style={{ maxWidth: 780 }}><p className="muted">Loading…</p></div>

  if (!data) {
    return (
      <div className="page" style={{ maxWidth: 780, textAlign: 'center', paddingTop: '4rem' }}>
        <p className="muted">About page not yet configured. Set <code>PUBLIC_TENANT_ID</code> and fill your profile.</p>
      </div>
    )
  }

  const specialties = data.specialties
    ? data.specialties.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
        {data.headshot_url && (
          <img
            src={data.headshot_url}
            alt={data.agency_name}
            style={{ width: 160, height: 160, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Recruiting Professional</p>
          <h1 style={{ marginBottom: '0.35rem' }}>{data.agency_name}</h1>
          {data.tagline && <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{data.tagline}</p>}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {data.contact_email && (
              <a href={`mailto:${data.contact_email}`} className="btn primary" style={{ textDecoration: 'none' }}>
                ✉ Contact me
              </a>
            )}
            {data.linkedin_url && (
              <a href={data.linkedin_url} target="_blank" rel="noreferrer" className="btn ghost" style={{ textDecoration: 'none' }}>
                🔗 LinkedIn
              </a>
            )}
            <Link to="/jobs" className="btn ghost" style={{ textDecoration: 'none' }}>
              📋 View open jobs
            </Link>
          </div>
        </div>
      </div>

      {data.bio && (
        <div className="form-card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>About Me</h2>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: '0.97rem' }}>{data.bio}</p>
        </div>
      )}

      {specialties.length > 0 && (
        <div className="form-card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>Specialties</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {specialties.map((s) => (
              <span key={s} style={{ padding: '0.3rem 0.8rem', borderRadius: 20, background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: '0.88rem', fontWeight: 600 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="form-card">
        <h2 style={{ marginBottom: '0.75rem' }}>Work with me</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
          Whether you're a company looking for top talent or a professional exploring your next move, I'm here to help. Let's talk.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {data.contact_email && (
            <a href={`mailto:${data.contact_email}`} className="btn primary" style={{ textDecoration: 'none' }}>✉ Send me an email</a>
          )}
          {data.contact_phone && (
            <a href={`tel:${data.contact_phone}`} className="btn ghost" style={{ textDecoration: 'none' }}>📞 {data.contact_phone}</a>
          )}
          <Link to="/post-job" className="btn ghost" style={{ textDecoration: 'none' }}>Post a job opening</Link>
        </div>
      </div>
    </div>
  )
}
