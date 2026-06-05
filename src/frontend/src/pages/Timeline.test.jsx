import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Timeline from './Timeline'

// ---------- Mock Recharts (avoid canvas in jsdom) ----------
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => children,
  ComposedChart: ({ children }) => <div data-testid="composed-chart">{children}</div>,
  Line: () => null,
  Scatter: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}))

// ---------- Mock data ----------
const WEIGHT_LOGS = [
  { weight: 156.2, logged_at: '2026-03-28T08:00:00Z' },
  { weight: 155.0, logged_at: '2026-03-29T08:00:00Z' },
  { weight: 154.5, logged_at: '2026-03-30T08:00:00Z' },
]

const MATCHES = [
  { match_date: '2026-03-28', result: 'win', opponent_name: 'Smith, John', score: '8-2' },
  { match_date: '2026-03-30', result: 'loss', opponent_name: 'Jones, Mike', score: '3-7' },
]

// ---------- Supabase mock ----------
function makeBuilder(resolveValue) {
  const b = {
    select: () => b,
    eq: () => b,
    order: () => b,
    then: (resolve, reject) => Promise.resolve(resolveValue).then(resolve, reject),
  }
  return b
}

function makeDefaultFrom() {
  return (table) => ({
    select: () => {
      if (table === 'weight_logs') return makeBuilder({ data: WEIGHT_LOGS, error: null })
      if (table === 'matches') return makeBuilder({ data: MATCHES, error: null })
      return makeBuilder({ data: [], error: null })
    },
  })
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'uid-1' }, access_token: 'test-jwt' } },
      }),
    },
    from: makeDefaultFrom(),
  },
}))

import { supabase } from '../lib/supabase'

// ---------- Helpers ----------
function createTestClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderWithClient(ui) {
  const client = createTestClient()
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from = makeDefaultFrom()
})

// ---------- Tests ----------
describe('Timeline', () => {
  it('renders without crashing and shows chart', async () => {
    renderWithClient(<Timeline />)
    await waitFor(() => {
      expect(screen.getByText('TIMELINE')).toBeInTheDocument()
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument()
    })
  })

  it('shows legend for win/loss/draw colors', async () => {
    renderWithClient(<Timeline />)
    await waitFor(() => {
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument()
    })
    // Legend items appear in a flex container alongside colored dots
    // "WIN" also appears in recent matches list, so use getAllByText
    expect(screen.getAllByText('WIN').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('LOSS').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('DRAW')).toBeInTheDocument()
  })

  it('shows recent matches list below chart', async () => {
    renderWithClient(<Timeline />)
    await waitFor(() => {
      expect(screen.getByText('RECENT MATCHES')).toBeInTheDocument()
      expect(screen.getByText(/Smith, John/)).toBeInTheDocument()
      expect(screen.getByText(/Jones, Mike/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no weight logs', async () => {
    supabase.from = (table) => ({
      select: () => makeBuilder({ data: [], error: null }),
    })

    renderWithClient(<Timeline />)
    await waitFor(() => {
      expect(screen.getByText(/Log weight entries to see/)).toBeInTheDocument()
    })
  })

  it('error path — shows error when Supabase fails', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: null, error: { message: 'Timeline load error' } }),
    })

    renderWithClient(<Timeline />)
    await waitFor(() => {
      expect(screen.getByText(/Timeline load error/)).toBeInTheDocument()
    })
  })

  it('auth — no crash if no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<Timeline />)
    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).not.toBeInTheDocument()
    })
  })
})
