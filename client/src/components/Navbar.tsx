import { NavLink } from 'react-router-dom'
import { clearToken, getAuthMeta, getToken } from '../auth'

type NavbarProps = {
  variant: 'public' | 'app'
}

const APP_PRIMARY = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/candidates', label: 'Candidates' },
  { to: '/job-orders', label: 'Jobs' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/leads', label: 'Leads' },
] as const

const APP_MORE = [
  { to: '/applications', label: 'Applications' },
  { to: '/interviews', label: 'Interviews' },
  { to: '/team', label: 'Team' },
  { to: '/ai/rankings', label: 'AI Rankings' },
  { to: '/ai/outreach', label: 'AI Outreach' },
  { to: '/ai/tools', label: 'AI Tools' },
  { to: '/email-templates', label: 'Templates' },
  { to: '/reports', label: 'Reports' },
  { to: '/webhooks', label: 'Webhooks' },
  { to: '/blog-editor', label: 'Blog' },
  { to: '/profile', label: 'Profile' },
  { to: '/billing', label: 'Billing' },
] as const

const PUBLIC_LINKS = [
  { to: '/jobs', label: 'Job Board' },
  { to: '/about', label: 'About' },
  { to: '/blog', label: 'Blog' },
  { to: '/client', label: 'Client Portal' },
  { to: '/post-job', label: 'Post a Job' },
] as const

function signOut() {
  clearToken()
  globalThis.location.assign(`${globalThis.location.origin}/login`)
}

export function Navbar({ variant }: Readonly<NavbarProps>) {
  const token = getToken()
  const meta = getAuthMeta()

  return (
    <header className="top">
      <NavLink to={token ? '/' : '/jobs'} className="brand">
        RecruitCommand
      </NavLink>
      <nav className={`nav nav--${variant}`}>
        {variant === 'app' ? (
          <>
            {APP_PRIMARY.map(({ to, label, ...rest }) => (
              <NavLink key={to} to={to} {...rest}>
                {label}
              </NavLink>
            ))}
            <details className="nav-more">
              <summary>More</summary>
              <div className="nav-more__menu">
                {APP_MORE.map(({ to, label }) => (
                  <NavLink key={to} to={to}>
                    {label}
                  </NavLink>
                ))}
              </div>
            </details>
          </>
        ) : (
          PUBLIC_LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))
        )}
        {variant === 'app' && meta.tenant_name && (
          <span className="nav-tenant muted small" title="Signed-in workspace">
            {meta.tenant_name}
          </span>
        )}
        {token ? (
          <>
            {variant === 'public' && <NavLink to="/">Dashboard</NavLink>}
            <button type="button" className="btn-link" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Sign in</NavLink>
            <NavLink to="/register" className="nav-cta">
              Get started
            </NavLink>
          </>
        )}
      </nav>
    </header>
  )
}
