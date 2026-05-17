import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createBillingPortal,
  createCheckoutSession,
  getBillingStatus,
  verifyCheckoutSession,
  refreshToken,
  type BillingStatus,
} from '../api'
import { getAuthMeta, setToken } from '../auth'

function daysLeft(isoDate: string): number {
  return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000))
}

function planLabel(plan: string): string {
  if (plan === 'active') return 'Active'
  if (plan === 'trialing') return 'Free Trial'
  if (plan === 'past_due') return 'Past Due'
  return 'Canceled'
}

export function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const meta = getAuthMeta()

  useEffect(() => {
    const upgraded = searchParams.get('upgraded')
    const sessionId = searchParams.get('session_id')
    if (upgraded && sessionId) {
      verifyCheckoutSession(sessionId)
        .then(() => refreshToken())
        .then((r) => { if (r.token) setToken(r.token, meta) })
        .catch(() => {})
        .finally(() => {
          getBillingStatus().then(setStatus).finally(() => setLoading(false))
        })
    } else {
      getBillingStatus().then(setStatus).finally(() => setLoading(false))
    }
  }, [])

  async function handleUpgrade() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await createCheckoutSession()
      if (r.checkout_url) {
        window.location.href = r.checkout_url
      } else {
        setMsg(r.error ?? 'Could not create checkout session')
      }
    } catch {
      setMsg('Could not reach API')
    } finally {
      setBusy(false)
    }
  }

  async function handlePortal() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await createBillingPortal()
      if (r.portal_url) {
        window.location.href = r.portal_url
      } else {
        setMsg(r.error ?? 'Could not open billing portal')
      }
    } catch {
      setMsg('Could not reach API')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>

  const plan = status?.plan ?? 'unknown'
  const isActive = plan === 'active'
  const isTrialing = plan === 'trialing'
  const days = status ? daysLeft(status.trial_ends_at) : 0

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <p className="eyebrow">Settings</p>
      <h1>Billing &amp; Subscription</h1>

      {meta.tenant_name && <p className="lede"><strong>{meta.tenant_name}</strong></p>}

      {searchParams.get('upgraded') && (
        <div className="banner" style={{ background: 'var(--green, #22c55e)', color: '#fff', marginBottom: '1rem' }}>
          Payment successful! Your subscription is now active.
        </div>
      )}
      {searchParams.get('canceled') && (
        <div className="banner error">Checkout canceled — no charge made.</div>
      )}
      {msg && <div className="banner error">{msg}</div>}

      <div className="weekly-stage-card">
        <h2>Plan: {planLabel(plan)}</h2>
        {isTrialing && (
          <p className="muted small">
            Trial ends in <strong>{days} day{days === 1 ? '' : 's'}</strong>.
            Upgrade to keep full access.
          </p>
        )}
        {isActive && <p className="muted small">Your subscription is active. Thank you!</p>}
        {!isActive && !isTrialing && (
          <p className="muted small" style={{ color: 'var(--red, #ef4444)' }}>
            Your subscription is <strong>{planLabel(plan)}</strong>. Reactivate to regain access.
          </p>
        )}

        <div className="actions" style={{ marginTop: '1.5rem' }}>
          {!isActive && status?.stripe_enabled && (
            <button className="btn primary" onClick={handleUpgrade} disabled={busy}>
              {busy ? 'Loading…' : isTrialing ? 'Upgrade now — $39/mo' : 'Reactivate subscription'}
            </button>
          )}
          {isActive && status?.stripe_enabled && status.has_subscription && (
            <button className="btn ghost" onClick={handlePortal} disabled={busy}>
              {busy ? 'Loading…' : 'Manage billing / cancel'}
            </button>
          )}
          {!status?.stripe_enabled && (
            <p className="muted small">
              Stripe is not configured on this server. Set <code>STRIPE_SECRET_KEY</code> and{' '}
              <code>STRIPE_PRICE_ID</code> to enable payments.
            </p>
          )}
        </div>
      </div>

      <div className="weekly-stage-card" style={{ marginTop: '1.5rem' }}>
        <h2>What&apos;s included</h2>
        <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
          <li>Unlimited candidates &amp; job orders</li>
          <li>Full pipeline tracking (7 stages)</li>
          <li>AI outreach drafts &amp; job posting import</li>
          <li>CSV export &amp; activity logs</li>
          <li>Team seats (coming soon)</li>
        </ul>
      </div>
    </div>
  )
}
