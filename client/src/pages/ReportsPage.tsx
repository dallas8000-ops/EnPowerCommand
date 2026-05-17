import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

type Summary = {
  total_candidates: number
  active_candidates: number
  total_job_orders: number
  open_jobs: number
  total_placements: number
  total_applications: number
  placements_this_month: number
  revenue_this_month: number | null
}

async function getReportSummary(): Promise<Summary> {
  const res = await apiFetch('/api/analytics/summary')
  return res.json() as Promise<Summary>
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="btn ghost"
      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
    >
      ⬇ {label}
    </a>
  )
}

export function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReportSummary()
      .then((s) => setSummary(s))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <p className="eyebrow">Reporting</p>
      <h1>Reports &amp; Exports</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>Download your data as CSV files, importable into Excel or Google Sheets.</p>

      {loading && <p className="muted">Loading summary…</p>}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Candidates', value: summary.total_candidates },
            { label: 'Active Candidates', value: summary.active_candidates },
            { label: 'Open Jobs', value: summary.open_jobs },
            { label: 'Total Placements', value: summary.total_placements },
            { label: 'Applications', value: summary.total_applications },
            { label: 'Placements This Month', value: summary.placements_this_month },
            ...(summary.revenue_this_month != null
              ? [{ label: 'Revenue This Month', value: `$${Number(summary.revenue_this_month).toLocaleString()}` }]
              : []),
          ].map((stat) => (
            <div key={stat.label} className="form-card" style={{ padding: '0.85rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent)' }}>{stat.value}</p>
              <p className="muted small">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="form-card">
        <h2 style={{ marginBottom: '1rem' }}>CSV Exports</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontWeight: 600 }}>Candidates</p>
              <p className="muted small">Name, email, phone, title, location, skills, status</p>
            </div>
            <DownloadLink href="/api/exports/candidates.csv" label="Download" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontWeight: 600 }}>Placements</p>
              <p className="muted small">Candidate, company, job title, stage, fee, date</p>
            </div>
            <DownloadLink href="/api/exports/placements.csv" label="Download" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontWeight: 600 }}>Job Orders</p>
              <p className="muted small">Company, title, location, salary, status, date opened</p>
            </div>
            <DownloadLink href="/api/exports/job-orders.csv" label="Download" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0' }}>
            <div>
              <p style={{ fontWeight: 600 }}>Applications</p>
              <p className="muted small">Applicant, email, phone, job applied for, status</p>
            </div>
            <DownloadLink href="/api/exports/applications.csv" label="Download" />
          </div>
        </div>
      </div>
    </div>
  )
}
