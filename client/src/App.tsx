import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { getHealth } from './api'
import { clearToken, getAuthMeta, getToken } from './auth'
import './App.css'
import { BillingPage } from './pages/BillingPage'
import { CandidateEditorPage } from './pages/CandidateEditorPage'
import { CandidatesPage } from './pages/CandidatesPage'
import { Home } from './pages/Home'
import { ImportLeadPage } from './pages/ImportLeadPage'
import { JobOrderEditorPage } from './pages/JobOrderEditorPage'
import { JobOrdersPage } from './pages/JobOrdersPage'
import { LeadEditorPage } from './pages/LeadEditorPage'
import { LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'
import { PipelinePage } from './pages/PipelinePage'
import { ProfilePage } from './pages/ProfilePage'
import { JobBoardPage } from './pages/JobBoardPage'
import { PostJobPage } from './pages/PostJobPage'
import { RegisterPage } from './pages/RegisterPage'

function ProtectedLayout() {
  const [gate, setGate] = useState<'loading' | 'login' | 'app'>('loading')
  const meta = getAuthMeta()

  useEffect(() => {
    getHealth()
      .then((h) => {
        if (h.auth_required && !getToken()) setGate('login')
        else setGate('app')
      })
      .catch(() => setGate('app'))
  }, [])

  if (gate === 'loading') {
    return (
      <div className="shell">
        <main className="main">
          <p className="muted">Loading…</p>
        </main>
      </div>
    )
  }

  if (gate === 'login') {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="shell">
      <header className="top">
        <NavLink to="/" className="brand">
          RecruitCommand
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/candidates">Candidates</NavLink>
          <NavLink to="/job-orders">Jobs</NavLink>
          <NavLink to="/pipeline">Pipeline</NavLink>
          <NavLink to="/leads">Leads</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          <NavLink to="/billing" title={meta.tenant_name ?? 'Billing'}>Billing</NavLink>
          {getToken() && (
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                clearToken()
                window.location.assign(`${window.location.origin}/login`)
              }}
            >
              Sign out
            </button>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/jobs" element={<JobBoardPage />} />
      <Route path="/post-job" element={<PostJobPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/candidates" element={<CandidatesPage />} />
        <Route path="/candidates/:id" element={<CandidateEditorPage />} />
        <Route path="/job-orders" element={<JobOrdersPage />} />
        <Route path="/job-orders/:id" element={<JobOrderEditorPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/import" element={<ImportLeadPage />} />
        <Route path="/leads/:id" element={<LeadEditorPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/billing" element={<BillingPage />} />
      </Route>
    </Routes>
  )
}

export default App
