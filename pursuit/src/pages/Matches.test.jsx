import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Matches from './Matches'

// ---------- Mock data ----------
const MATCH_LIST = [
  {
    id: 'm1',
    opponent_name: 'Smith, John',
    result: 'win',
    score: '8-2',
    win_type: 'decision',
    tournament: 'Regionals',
    match_date: '2026-03-15',
  },
  {
    id: 'm2',
    opponent_name: 'Jones, Mike',
    result: 'loss',
    score: '3-7',
    win_type: null,
    tournament: null,
    match_date: '2026-03-10',
  },
]

const OUTCOME_RESULT = {
  win_probability: 0.72,
  confidence: 'medium',
  factors: ['Strong recent form', 'High pin rate'],
}

// ---------- Supabase mock ----------
const mockInsert = vi.fn()

function makeBuilder(resolveValue) {
  const b = {
    select: () => b,
    eq: () => b,
    order: () => b,
    range: () => b,
    then: (resolve, reject) => Promise.resolve(resolveValue).then(resolve, reject),
  }
  return b
}

function makeDefaultFrom() {
  return (table) => {
    return {
      select: (columns) => {
        if (columns === 'result') {
          // matches-record query: returns just results (no order/range)
          return makeBuilder({ data: MATCH_LIST.map(m => ({ result: m.result })), error: null })
        }
        // paginated matches query: returns full objects
        return makeBuilder({ data: MATCH_LIST, error: null })
      },
      insert: (payload) => {
        mockInsert(payload)
        return mockInsert._result ?? Promise.resolve({ error: null })
      },
    }
  }
}

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'uid-1' }, access_token: 'test-jwt' },
          },
        }),
      },
      from: makeDefaultFrom(),
    },
  }
})

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

// ---------- Fetch mock ----------
const originalFetch = globalThis.fetch
beforeEach(() => {
  vi.clearAllMocks()
  mockInsert._result = undefined
  supabase.from = makeDefaultFrom()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(OUTCOME_RESULT),
  })
})
afterAll(() => {
  globalThis.fetch = originalFetch
})

// ---------- Tests ----------
describe('Matches', () => {
  it('renders without crashing and shows match list', async () => {
    renderWithClient(<Matches />)
    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument()
    })
    expect(screen.getByText('MATCHES')).toBeInTheDocument()
    expect(screen.getByText('Jones, Mike')).toBeInTheDocument()
  })

  it('happy path — shows W-L record', async () => {
    renderWithClient(<Matches />)
    await waitFor(() => {
      const wins = screen.getByText('1', { selector: 'span.text-green-500' })
      const losses = screen.getByText('1', { selector: 'span.text-red-500' })
      expect(wins).toBeInTheDocument()
      expect(losses).toBeInTheDocument()
    })
  })

  it('happy path — match outcome predictor returns results', async () => {
    const user = userEvent.setup()
    renderWithClient(<Matches />)

    // Wait for data to fully load (not just the initial empty render)
    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('155.0'), '155')
    await user.type(screen.getByPlaceholderText('152'), '152')
    await user.click(screen.getByRole('button', { name: /predict/i }))

    await waitFor(() => {
      expect(screen.getByText('72')).toBeInTheDocument()
      expect(screen.getByText('MEDIUM')).toBeInTheDocument()
      expect(screen.getByText('Strong recent form')).toBeInTheDocument()
    })
  })

  it('silent failure — match outcome predictor hidden when FastAPI down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    renderWithClient(<Matches />)

    // Wait for data to fully load
    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('155.0'), '155')
    await user.type(screen.getByPlaceholderText('152'), '152')
    await user.click(screen.getByRole('button', { name: /predict/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /predict/i })).not.toBeDisabled()
    })

    expect(screen.queryByText('WIN PROBABILITY')).not.toBeInTheDocument()
  })

  it('error path — shows error when Supabase load fails', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: null, error: { message: 'Load failed' } }),
      insert: () => Promise.resolve({ error: null }),
    })

    renderWithClient(<Matches />)
    await waitFor(() => {
      expect(screen.getByText(/Load failed/)).toBeInTheDocument()
    })
  })

  it('cold-start hint — shows "N more matches needed" when < 10 matches', async () => {
    renderWithClient(<Matches />)
    await waitFor(() => {
      // MATCH_LIST has 2 matches, so 8 more needed
      expect(screen.getByText(/8 more matches needed/)).toBeInTheDocument()
    })
  })

  it('cold-start hint — hidden when >= 10 matches', async () => {
    const tenMatches = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      opponent_name: `Opponent ${i}`,
      result: 'win',
      score: '5-0',
      win_type: 'decision',
      tournament: null,
      match_date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    }))

    supabase.from = (table) => ({
      select: (columns) => {
        if (columns === 'result') {
          return makeBuilder({ data: tenMatches.map(m => ({ result: m.result })), error: null })
        }
        return makeBuilder({ data: tenMatches, error: null })
      },
      insert: () => Promise.resolve({ error: null }),
    })

    renderWithClient(<Matches />)
    await waitFor(() => {
      expect(screen.getByText('MATCHES')).toBeInTheDocument()
    })
    expect(screen.queryByText(/more match.*needed/)).not.toBeInTheDocument()
  })

  it('auth — returns early if no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<Matches />)
    // With no session, uid stays null, queries disabled
    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).not.toBeInTheDocument()
    })
  })
})
