import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'

// ---------- Mock data ----------
const WRESTLER = { id: 'uid-1', name: 'Test Wrestler', weight_class: 152, show_on_board: false }
const WEIGHT_LOG = { weight: 158.5, logged_at: '2026-04-01T10:00:00Z' }

// Build streak logs — today + 2 prior consecutive days
const today = new Date()
today.setHours(10, 0, 0, 0)
const STREAK_LOGS = [
  { logged_at: today.toISOString() },
  { logged_at: new Date(today.getTime() - 86400000).toISOString() },
  { logged_at: new Date(today.getTime() - 2 * 86400000).toISOString() },
]

const MATCHES = [
  { result: 'win' },
  { result: 'win' },
  { result: 'loss' },
]
const EVENT = {
  id: 'e1',
  title: 'Regional Qualifier',
  starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  location: 'Fieldhouse B',
}
const PERF_TREND = {
  win_rate: 0.6667,
  recent_win_rate: 0.8,
  trend: 'improving',
  insight: 'You are trending up.',
}

// Activity feed items
const FEED_LOG = {
  weight: 155.0,
  logged_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  wrestler_id: 'uid-2',
  wrestlers: { name: 'Teammate A', show_on_board: true },
}
const FEED_MATCH = {
  result: 'win',
  match_date: '2026-04-04',
  opponent_name: 'Opponent X',
  wrestler_id: 'uid-3',
  wrestlers: { name: 'Teammate B', show_on_board: true },
}

// ---------- Supabase mock ----------
const mockSession = {
  user: { id: 'uid-1' },
  access_token: 'test-jwt',
}

// Track which query path was called via select columns + table
// Dashboard does 8 parallel queries. We disambiguate by tracking
// table + select columns + chain methods used.
function makeFrom() {
  return (table) => {
    let selectCols = ''
    let isNeq = false
    let isSingle = false

    const chain = {
      select: (cols) => { selectCols = cols ?? ''; return chain },
      eq: () => chain,
      neq: () => { isNeq = true; return chain },
      gt: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => {
        isSingle = true
        if (table === 'wrestlers') return Promise.resolve({ data: WRESTLER, error: null })
        return Promise.resolve({ data: null, error: null })
      },
      then: (resolve) => {
        // Feed queries use .neq('wrestler_id', uid) and join syntax
        if (isNeq) {
          if (table === 'weight_logs') return resolve({ data: [FEED_LOG], error: null })
          if (table === 'matches') return resolve({ data: [FEED_MATCH], error: null })
          if (table === 'schedules') return resolve({ data: [], error: null })
          return resolve({ data: [], error: null })
        }

        // Own-data queries
        if (table === 'weight_logs') {
          // Two weight_log queries: one with limit(1) for latest, one with limit(90) for streak
          // Both return arrays. The limit(1) has 'weight, logged_at', limit(90) has 'logged_at'
          if (selectCols === 'logged_at') return resolve({ data: STREAK_LOGS, error: null })
          return resolve({ data: [WEIGHT_LOG], error: null })
        }
        if (table === 'matches') return resolve({ data: MATCHES, error: null })
        if (table === 'schedules') return resolve({ data: [EVENT], error: null })

        return resolve({ data: [], error: null })
      },
    }
    return chain
  }
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: makeFrom(),
  },
}))

import { supabase } from '../lib/supabase'

// ---------- Fetch mock ----------
const originalFetch = globalThis.fetch
beforeEach(() => {
  vi.clearAllMocks()
  supabase.from = makeFrom()
  supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } })
  globalThis.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('performance-trend')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(PERF_TREND) })
    }
    if (url.includes('weight-cut')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            lbs_to_cut: 6.5,
            daily_cut_rate: 0.93,
            is_safe: true,
            recommendation: 'Cut 0.9 lbs/day.',
          }),
      })
    }
    return Promise.resolve({ ok: false })
  })
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

// ---------- Tests ----------
describe('Dashboard', () => {
  it('renders without crashing and shows loading then content', async () => {
    renderDashboard()
    expect(screen.getByText('LOADING...')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    })
  })

  it('happy path — displays wrestler stats from mocked Supabase data', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('158.5 LBS')).toBeInTheDocument()
    })
    expect(screen.getByText('152 LBS')).toBeInTheDocument()
    expect(screen.getByText(/2—1/)).toBeInTheDocument()
  })

  it('happy path — displays performance trend card when FastAPI returns data', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('PERFORMANCE TREND')).toBeInTheDocument()
    })
    expect(screen.getByText('IMPROVING')).toBeInTheDocument()
    expect(screen.getByText('You are trending up.')).toBeInTheDocument()
  })

  it('lbs-to-cut shows ON WEIGHT when wrestler is under weight class', async () => {
    const underWeightFrom = (table) => {
      let selectCols = ''
      let isNeq = false
      const chain = {
        select: (cols) => { selectCols = cols ?? ''; return chain },
        eq: () => chain,
        neq: () => { isNeq = true; return chain },
        gt: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => {
          if (table === 'wrestlers') return Promise.resolve({ data: WRESTLER, error: null })
          return Promise.resolve({ data: null, error: null })
        },
        then: (resolve) => {
          if (isNeq) return resolve({ data: [], error: null })
          if (table === 'weight_logs') {
            if (selectCols === 'logged_at') return resolve({ data: STREAK_LOGS, error: null })
            return resolve({ data: [{ weight: 150.0, logged_at: '2026-04-01T10:00:00Z' }], error: null })
          }
          if (table === 'matches') return resolve({ data: MATCHES, error: null })
          if (table === 'schedules') return resolve({ data: [EVENT], error: null })
          return resolve({ data: [], error: null })
        },
      }
      return chain
    }
    supabase.from = underWeightFrom

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('ON WEIGHT')).toBeInTheDocument()
    })
  })

  it('lbs-to-cut highlights amber when > 5 lbs over', async () => {
    supabase.from = makeFrom()
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('6.5 LBS')).toBeInTheDocument()
    })
  })

  it('displays logging streak stat', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('3D')).toBeInTheDocument()
    })
    expect(screen.getByText('LOG STREAK')).toBeInTheDocument()
  })

  it('displays activity feed from opted-in teammates', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('TEAM ACTIVITY — LAST 48H')).toBeInTheDocument()
    })
    expect(screen.getByText('Teammate A')).toBeInTheDocument()
    expect(screen.getByText(/logged 155 lbs/)).toBeInTheDocument()
    expect(screen.getByText('Teammate B')).toBeInTheDocument()
    expect(screen.getByText(/won vs Opponent X/)).toBeInTheDocument()
  })

  it('feed error isolation — dashboard renders even if feed queries fail', async () => {
    // Feed queries throw but core dashboard should still render
    supabase.from = (table) => {
      let selectCols = ''
      let isNeq = false
      const chain = {
        select: (cols) => { selectCols = cols ?? ''; return chain },
        eq: () => chain,
        neq: () => { isNeq = true; return chain },
        gt: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => {
          if (table === 'wrestlers') return Promise.resolve({ data: WRESTLER, error: null })
          return Promise.resolve({ data: null, error: null })
        },
        then: (resolve, reject) => {
          // Feed queries (neq) throw to simulate RLS error
          if (isNeq) throw new Error('RLS policy not found')
          if (table === 'weight_logs') {
            if (selectCols === 'logged_at') return resolve({ data: STREAK_LOGS, error: null })
            return resolve({ data: [WEIGHT_LOG], error: null })
          }
          if (table === 'matches') return resolve({ data: MATCHES, error: null })
          if (table === 'schedules') return resolve({ data: [EVENT], error: null })
          return resolve({ data: [], error: null })
        },
      }
      return chain
    }

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    })
    // Core stats still render
    expect(screen.getByText('158.5 LBS')).toBeInTheDocument()
    expect(screen.getByText(/2—1/)).toBeInTheDocument()
    // Feed section is hidden (not errored)
    expect(screen.queryByText('TEAM ACTIVITY')).not.toBeInTheDocument()
    // No error message shown
    expect(screen.queryByText('RLS policy not found')).not.toBeInTheDocument()
  })

  it('silent failure — performance trend card is hidden when FastAPI is down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    })
    expect(screen.queryByText('PERFORMANCE TREND')).not.toBeInTheDocument()
  })

  it('error path — shows error when Supabase query fails', async () => {
    supabase.from = () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        neq: () => chain,
        gt: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => { throw new Error('DB error') },
        then: () => { throw new Error('DB error') },
      }
      return chain
    }

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeInTheDocument()
    })
  })

  it('auth — returns early if no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    renderDashboard()

    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).not.toBeInTheDocument()
    })
  })
})
