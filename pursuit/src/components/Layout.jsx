import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/dashboard', label: 'DASHBOARD' },
  { to: '/weight', label: 'WEIGHT' },
  { to: '/matches', label: 'MATCHES' },
  { to: '/notes', label: 'NOTES' },
  { to: '/schedule', label: 'SCHEDULE' },
  { to: '/workouts', label: 'WORKOUTS' },
  { to: '/goals', label: 'GOALS' },
  { to: '/nutrition', label: 'NUTRITION' },
  { to: '/records', label: 'RECORDS' },
  { to: '/timeline', label: 'TIMELINE' },
  { to: '/board', label: 'BOARD' },
  { to: '/profile', label: 'PROFILE' },
]

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function close() { setSidebarOpen(false) }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-[#080808] border-b border-[#1a1a1a] flex items-center px-4 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="w-10 h-10 flex items-center justify-center text-[#d97706]"
        >
          {/* Three-line hamburger */}
          <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor">
            <rect y="0" width="20" height="2" rx="1" />
            <rect y="7" width="20" height="2" rx="1" />
            <rect y="14" width="20" height="2" rx="1" />
          </svg>
        </button>
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none font-display font-bold tracking-[0.25em] text-sm text-[#d97706]">
          PURSUIT
        </span>
      </div>

      {/* ── Overlay (mobile only) ── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      {/*
        Mobile: fixed, slides in/out via inline transform (avoids Tailwind JIT
        not scanning dynamic class names in template literals).
        Desktop (md:): fixed, always visible — inline style doesn't apply
        because we reset it via the `md:` class below.
      */}
      <aside
        className="fixed top-0 left-0 h-screen w-[280px] md:w-48 bg-[#080808] border-r border-[#1a1a1a] flex flex-col z-40 md:z-10 transition-transform duration-300 -translate-x-full md:translate-x-0"
        style={{ transform: sidebarOpen ? 'translateX(0)' : undefined }}
      >
        {/* Sidebar header — close button visible on mobile only */}
        <div className="px-6 py-5 border-b border-[#1a1a1a] flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-xl tracking-[0.25em] text-[#d97706]">
              PURSUIT
            </div>
            <div className="font-mono text-[9px] text-[#3a3a3a] tracking-[0.2em] mt-0.5">
              TRAINING SYSTEM
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close menu"
            className="md:hidden w-8 h-8 flex items-center justify-center text-[#aaa] hover:text-[#aaa] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={close}
              className={({ isActive }) =>
                `flex items-center px-6 py-3 text-[10px] tracking-[0.18em] font-display font-medium transition-colors ${
                  isActive
                    ? 'text-[#d97706] border-l-2 border-[#d97706] bg-[#d97706]/5'
                    : 'text-[#aaa] border-l-2 border-transparent hover:text-[#ccc] hover:border-[#333]'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleSignOut}
          className="mx-5 mb-5 px-4 py-2 text-[10px] tracking-[0.18em] font-display font-medium text-[#888] border border-[#1e1e1e] hover:border-[#d97706] hover:text-[#d97706] transition-colors"
        >
          SIGN OUT
        </button>
      </aside>

      {/* ── Main content ── */}
      <main className="w-full md:ml-48 flex-1 min-h-screen p-4 md:p-8 pt-16 md:pt-8 max-w-5xl">
        {children}
      </main>

    </div>
  )
}
