import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function PublicLayout() {
  return (
    <div className="shell">
      <Navbar variant="public" />
      <main className="main main--public">
        <Outlet />
      </main>
    </div>
  )
}
