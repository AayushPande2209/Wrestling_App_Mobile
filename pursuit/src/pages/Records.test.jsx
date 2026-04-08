import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Records from './Records'

// ---------- Mock data ----------
const MATCHES = [
  { id: 'm1', match_date: '2026-01-10', opponent_name: 'Smith, John', result: 'win', score: '8-2', win_type: 'decision', tournament: 'Regionals' },
  { id: 'm2', match_date: '2026-01-15', opponent_name: 'Jones, Mike', result: 'win', score: '3-0', win_type: 'pin', tournament: 'Regionals' },
  { id: 'm3', match_date: '2026-01-20', opponent_name: 'Brown, Chris', result: 'loss', score: '2-6', win_type: null, tournament: 'State' },
  { id: 'm4', match_date: '2026-02-05', opponent_name: 'Davis, Pat', result: 'win', score: '12-1', win_type: 'major', tournament: 'State' },
  { id: 'm5', match_date: '2026-02-10', opponent_name: 'Wilson, Sam', result: 'win', score: '5-0', win_type: 'pin', tournament: null },
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
  return () => ({
    select: () => makeBuilder({ data: MATCHES, error: null }),
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
describe('Records', () => {
  it('renders without crashing and shows career summary', async () => {
    renderWithClient(<Records />)
    await waitFor(() => {
      expect(screen.getByText('RECORDS')).toBeInTheDocument()
      expect(screen.getByText('CAREER SUMMARY')).toBeInTheDocument()
    })
  })

  it('computes longest win streak correctly', async () => {
    renderWithClient(<Records />)
    await waitFor(() => {
      // m1 win, m2 win → streak of 2 (broken by m3 loss), then m4 win, m5 win → streak of 2
      // Both are 2, so first found (m1-m2) gets it
      expect(screen.getByText('2 IN A ROW')).toBeInTheDocument()
    })
  })

  it('computes biggest point differential correctly', async () => {
    renderWithClient(<Records />)
    await waitFor(() => {
      // m4: 12-1 = 11 pts diff (biggest)
      expect(screen.getByText('+11 PTS')).toBeInTheDocument()
      expect(screen.getByText(/12-1 vs Davis, Pat/)).toBeInTheDocument()
    })
  })

  it('shows first pin record', async () => {
    renderWithClient(<Records />)
    await waitFor(() => {
      expect(screen.getByText('PIN WIN')).toBeInTheDocument()
      // First pin is m2 (matches ordered by match_date desc from query,
      // but pins are iterated in order — m2 is first)
      expect(screen.getByText(/Jones, Mike/)).toBeInTheDocument()
    })
  })

  it('shows best tournament', async () => {
    renderWithClient(<Records />)
    await waitFor(() => {
      // Regionals: 2W 0L; State: 1W 1L → Regionals is best
      expect(screen.getByText('2W 0L')).toBeInTheDocument()
      expect(screen.getByText('Regionals')).toBeInTheDocument()
    })
  })

  it('shows career summary stats', async () => {
    renderWithClient(<Records />)
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument() // total matches
      expect(screen.getByText('80%')).toBeInTheDocument() // win rate (4/5)
    })
  })

  it('parses scores with whitespace and trailing text (e.g. "8 - 2 OT")', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({
        data: [
          { id: 'x1', match_date: '2026-03-01', opponent_name: 'A', result: 'win', score: '10 - 3 OT', win_type: 'decision', tournament: null },
          { id: 'x2', match_date: '2026-03-05', opponent_name: 'B', result: 'win', score: '4-2', win_type: 'decision', tournament: null },
        ],
        error: null,
      }),
    })

    renderWithClient(<Records />)
    await waitFor(() => {
      // "10 - 3 OT" → diff 7, "4-2" → diff 2, biggest is 7
      expect(screen.getByText('+7 PTS')).toBeInTheDocument()
    })
  })

  it('shows MOST RECENT PIN label (not fastest pin)', async () => {
    renderWithClient(<Records />)
    await waitFor(() => {
      expect(screen.getByText('MOST RECENT PIN')).toBeInTheDocument()
    })
  })

  it('shows empty state when no matches', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: [], error: null }),
    })

    renderWithClient(<Records />)
    await waitFor(() => {
      expect(screen.getByText(/Log matches to start building/)).toBeInTheDocument()
    })
  })

  it('error path — shows error when Supabase fails', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: null, error: { message: 'Records query failed' } }),
    })

    renderWithClient(<Records />)
    await waitFor(() => {
      expect(screen.getByText(/Records query failed/)).toBeInTheDocument()
    })
  })

  it('tournament FK join takes precedence over legacy text', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({
        data: [
          { id: 'f1', match_date: '2026-03-01', opponent_name: 'A', result: 'win', score: '5-0', win_type: 'pin', tournament: 'Legacy Name', tournaments: { name: 'FK Name' } },
          { id: 'f2', match_date: '2026-03-02', opponent_name: 'B', result: 'win', score: '3-1', win_type: 'decision', tournament: 'Legacy Name', tournaments: { name: 'FK Name' } },
        ],
        error: null,
      }),
    })

    renderWithClient(<Records />)
    await waitFor(() => {
      // Best tournament card should show the FK name, not legacy text
      expect(screen.getByText('FK Name')).toBeInTheDocument()
      expect(screen.queryByText('Legacy Name')).not.toBeInTheDocument()
    })
  })

  it('falls back to legacy tournament text when FK join is null', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({
        data: [
          { id: 'g1', match_date: '2026-03-01', opponent_name: 'C', result: 'win', score: '4-0', win_type: 'pin', tournament: 'Old Tourney', tournaments: null },
        ],
        error: null,
      }),
    })

    renderWithClient(<Records />)
    await waitFor(() => {
      expect(screen.getByText('Old Tourney')).toBeInTheDocument()
    })
  })

  it('auth — no crash if no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<Records />)
    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).not.toBeInTheDocument()
    })
  })
})
