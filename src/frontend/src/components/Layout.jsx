import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  IconRobot,
  IconLayoutDashboard,
  IconClipboardList,
  IconApple,
  IconTrophy,
  IconUsers,
  IconUserCircle,
} from '@tabler/icons-react'

const NAV = [
  { to: '/coach',     label: 'COACH',     Icon: IconRobot },
  { to: '/dashboard', label: 'DASHBOARD', Icon: IconLayoutDashboard },
  { to: '/logs',      label: 'LOGS',      Icon: IconClipboardList },
  { to: '/nutrition', label: 'NUTRITION', Icon: IconApple },
  { to: '/records',   label: 'RECORDS',   Icon: IconTrophy },
  { to: '/board',     label: 'BOARD',     Icon: IconUsers },
  { to: '/profile',   label: 'PROFILE',   Icon: IconUserCircle },
]

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [uid, setUid] = useState(null)
  const [wrestler, setWrestler] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  function close() { setSidebarOpen(false) }

  // Get uid once on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  // Re-fetch cut data whenever the wrestler navigates to a new page,
  // so the sidebar widget reflects a freshly logged weight without a hard reload.
  useEffect(() => {
    if (!uid) return
    supabase
      .from('wrestlers')
      .select('current_weight, weight_class')
      .eq('id', uid)
      .single()
      .then(({ data }) => { if (data) setWrestler(data) })
  }, [uid, location.pathname])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  const rawCut = wrestler?.current_weight != null && wrestler?.weight_class != null
    ? wrestler.current_weight - wrestler.weight_class
    : null
  const onWeight = rawCut !== null && rawCut <= 0
  const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null

  return (
    <div className="flex min-h-screen bg-[#0d0d0d]">

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-[#111] border-b border-[#1f1f1f] flex items-center px-4 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="w-10 h-10 flex items-center justify-center text-[#e8712a]"
        >
          <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor">
            <rect y="0" width="20" height="2" rx="1" />
            <rect y="7" width="20" height="2" rx="1" />
            <rect y="14" width="20" height="2" rx="1" />
          </svg>
        </button>
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none font-display font-bold tracking-[0.25em] text-sm text-[#e8712a]">
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
      <aside
        className="fixed top-0 left-0 h-screen w-[280px] md:w-48 bg-[#111] border-r border-[#1f1f1f] flex flex-col z-40 md:z-10 transition-transform duration-300 -translate-x-full md:translate-x-0"
        style={{ transform: sidebarOpen ? 'translateX(0)' : undefined }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1f1f1f] flex items-center justify-between shrink-0">
          <div>
            <div className="font-display font-bold text-xl tracking-[0.25em] text-[#e8712a]">
              PURSUIT
            </div>
            <div className="font-mono text-[9px] text-[#3a3a3a] tracking-[0.2em] mt-0.5">
              TRAINING SYSTEM
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close menu"
            className="md:hidden w-8 h-8 flex items-center justify-center text-[#666] hover:text-[#aaa] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        {/* Cut widget */}
        <div className="mx-3 mt-3 mb-1 p-3 border border-[#2a1a08] rounded-sm shrink-0">
          <div className="text-[9px] font-display tracking-[0.18em] text-[#888] mb-1">TO CUT</div>
          {lbsToCut !== null ? (
            <>
              <div className={`font-mono text-3xl font-bold leading-none ${onWeight ? 'text-[#22c55e]' : 'text-[#e8712a]'}`}>
                {onWeight ? '0.0' : lbsToCut.toFixed(1)}
                <span className="text-[11px] font-normal text-[#666] ml-1">LBS</span>
              </div>
              {onWeight && (
                <div className="font-mono text-[9px] text-[#22c55e] tracking-wider mt-0.5">ON WEIGHT</div>
              )}
              <div className="font-mono text-[10px] text-[#444] mt-1.5">
                {wrestler.current_weight} → {wrestler.weight_class}
              </div>
            </>
          ) : (
            <div className="font-mono text-2xl font-bold text-[#333]">—</div>
          )}
          <button
            onClick={() => { navigate('/weight'); close() }}
            className="w-full mt-2.5 py-1.5 text-[9px] tracking-[0.18em] font-display font-medium text-[#e8712a] border border-[#2a1a08] hover:bg-[#2a1a08] transition-colors"
          >
            + LOG WEIGHT
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto border-t border-[#1f1f1f] mt-2">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={close}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-[10px] tracking-[0.16em] font-display font-medium transition-colors ${
                  isActive
                    ? 'text-[#e8712a] bg-[#1a1208]'
                    : 'text-[#666] hover:text-[#aaa] hover:bg-[#161616]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={14} stroke={1.5} className={isActive ? 'text-[#e8712a]' : 'text-[#444]'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleSignOut}
          className="mx-4 mb-4 px-4 py-2 text-[10px] tracking-[0.18em] font-display font-medium text-[#555] border border-[#1f1f1f] hover:border-[#e8712a] hover:text-[#e8712a] transition-colors shrink-0"
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
