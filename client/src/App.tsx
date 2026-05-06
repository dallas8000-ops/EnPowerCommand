import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { getHealth } from './api'
import { clearToken, getToken } from './auth'
import './App.css'
import { Home } from './pages/Home'
import { ImportLeadPage } from './pages/ImportLeadPage'
import { LeadEditorPage } from './pages/LeadEditorPage'
import { LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'

function ProtectedLayout() {
  const [gate, setGate] = useState<'loading' | 'login' | 'app'>('loading')

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
          EnPower Command
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/leads">Leads</NavLink>
          <NavLink to="/leads/import">Import</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          {getToken() ? (
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
          ) : null}
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
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/import" element={<ImportLeadPage />} />
        <Route path="/leads/:id" element={<LeadEditorPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  )
}

export default App
