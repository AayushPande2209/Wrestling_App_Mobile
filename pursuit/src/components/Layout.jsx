import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/dashboard', label: 'DASHBOARD' },
  { to: '/weight', label: 'WEIGHT' },
  { to: '/matches', label: 'MATCHES' },
  { to: '/notes', label: 'NOTES' },
  { to: '/schedule', label: 'SCHEDULE' },
  { to: '/records', label: 'RECORDS' },
  { to: '/timeline', label: 'TIMELINE' },
  { to: '/board', label: 'BOARD' },
  { to: '/profile', label: 'PROFILE' },
]

export default function Layout({ children }) {
  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-48 bg-[#080808] border-r border-[#1a1a1a] flex flex-col z-10">
        <div className="px-6 py-5 border-b border-[#1a1a1a]">
          <div className="font-display font-bold text-xl tracking-[0.25em] text-[#d97706]">
            PURSUIT
          </div>
          <div className="font-mono text-[9px] text-[#3a3a3a] tracking-[0.2em] mt-0.5">
            TRAINING SYSTEM
          </div>
        </div>

        <nav className="flex-1 py-3">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center px-6 py-3 text-[10px] tracking-[0.18em] font-display font-medium transition-colors ${
                  isActive
                    ? 'text-[#d97706] border-l-2 border-[#d97706] bg-[#d97706]/5'
                    : 'text-[#555] border-l-2 border-transparent hover:text-[#ccc] hover:border-[#333]'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleSignOut}
          className="mx-5 mb-5 px-4 py-2 text-[10px] tracking-[0.18em] font-display font-medium text-[#444] border border-[#1e1e1e] hover:border-[#d97706] hover:text-[#d97706] transition-colors"
        >
          SIGN OUT
        </button>
      </aside>

      {/* Content */}
      <main className="ml-48 flex-1 min-h-screen p-8 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
