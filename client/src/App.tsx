import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { Home } from './pages/Home'
import { ImportLeadPage } from './pages/ImportLeadPage'
import { LeadEditorPage } from './pages/LeadEditorPage'
import { LeadsPage } from './pages/LeadsPage'
import { ProfilePage } from './pages/ProfilePage'

function App() {
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
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/import" element={<ImportLeadPage />} />
          <Route path="/leads/:id" element={<LeadEditorPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
