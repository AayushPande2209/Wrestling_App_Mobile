import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WeightLog from './WeightLog'

// ---------- Mock data ----------
const LOGS = [
  { weight: 156.2, time_of_day: 'morning', logged_at: '2026-03-28T08:00:00Z', note: null },
  { weight: 155.5, time_of_day: 'after_practice', logged_at: '2026-03-28T17:00:00Z', note: 'felt good' },
  { weight: 155.0, time_of_day: 'morning', logged_at: '2026-03-29T08:00:00Z', note: null },
  { weight: 154.5, time_of_day: 'night', logged_at: '2026-03-30T21:00:00Z', note: null },
]

// ---------- Supabase mock ----------
const mockInsert = vi.fn()
const mockUpdate = vi.fn()

function makeBuilder(resolveValue) {
  const b = {
    select: () => b,
    eq: () => b,
    order: () => b,
    limit: () => b,
    then: (resolve, reject) => Promise.resolve(resolveValue).then(resolve, reject),
  }
  return b
}

function makeDefaultFrom() {
  return (table) => ({
    select: () => makeBuilder({ data: LOGS, error: null }),
    insert: (payload) => {
      mockInsert(payload)
      return Promise.resolve({ error: null })
    },
    update: (payload) => {
      mockUpdate(payload)
      return { eq: () => Promise.resolve({ error: null }) }
    },
  })
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

// ---------- Recharts mock (avoid canvas issues in jsdom) ----------
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => children,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}))

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
  supabase.from = makeDefaultFrom()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        lbs_to_cut: 2.5,
        daily_cut_rate: 0.36,
        is_safe: true,
        recommendation: 'On track.',
      }),
  })
})
afterAll(() => {
  globalThis.fetch = originalFetch
})

// ---------- Tests ----------
describe('WeightLog', () => {
  it('renders without crashing and shows forms', async () => {
    renderWithClient(<WeightLog />)
    await waitFor(() => {
      expect(screen.getByText('WEIGHT LOG')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /log weight/i })).toBeInTheDocument()
    expect(screen.getByText('CUT PREDICTOR')).toBeInTheDocument()
    expect(screen.getByText('WEIGHT TREND PREDICTOR')).toBeInTheDocument()
  })

  it('happy path — chart renders with log data', async () => {
    renderWithClient(<WeightLog />)
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })
  })

  it('happy path — cut predictor returns result (silent on failure)', async () => {
    const user = userEvent.setup()
    renderWithClient(<WeightLog />)

    await waitFor(() => {
      expect(screen.getByText('CUT PREDICTOR')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('152'), '152')
    await user.type(screen.getByPlaceholderText('7'), '7')
    await user.click(screen.getByRole('button', { name: /analyze cut/i }))

    await waitFor(() => {
      expect(screen.getByText('On track.')).toBeInTheDocument()
    })
  })

  it('silent failure — cut predictor does not show error when FastAPI is down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    renderWithClient(<WeightLog />)

    await waitFor(() => {
      expect(screen.getByText('CUT PREDICTOR')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('152'), '152')
    await user.type(screen.getByPlaceholderText('7'), '7')
    await user.click(screen.getByRole('button', { name: /analyze cut/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /analyze cut/i })).not.toBeDisabled()
    })

    // No error message rendered — silent failure per spec §3
    expect(screen.queryByText('network')).not.toBeInTheDocument()
  })

  it('happy path — weight trend predictor returns result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ predicted_weight: 153.2, confidence: 'medium' }),
    })

    const user = userEvent.setup()
    renderWithClient(<WeightLog />)

    await waitFor(() => {
      expect(screen.getByText('WEIGHT TREND PREDICTOR')).toBeInTheDocument()
    })

    const trendSection = screen.getByText('WEIGHT TREND PREDICTOR').closest('div.border')
    const dateInput = trendSection.querySelector('input[type="date"]')

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(dateInput, '2026-04-15')
    dateInput.dispatchEvent(new Event('input', { bubbles: true }))
    dateInput.dispatchEvent(new Event('change', { bubbles: true }))

    await user.click(screen.getByRole('button', { name: /^predict$/i }))

    await waitFor(() => {
      expect(screen.getByText('153.2')).toBeInTheDocument()
      expect(screen.getByText('MEDIUM')).toBeInTheDocument()
    })
  })

  it('silent failure — weight trend hidden when FastAPI down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    renderWithClient(<WeightLog />)

    await waitFor(() => {
      expect(screen.getByText('WEIGHT TREND PREDICTOR')).toBeInTheDocument()
    })

    const trendSection = screen.getByText('WEIGHT TREND PREDICTOR').closest('div.border')
    const dateInput = trendSection.querySelector('input[type="date"]')

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(dateInput, '2026-04-15')
    dateInput.dispatchEvent(new Event('input', { bubbles: true }))
    dateInput.dispatchEvent(new Event('change', { bubbles: true }))

    await user.click(screen.getByRole('button', { name: /^predict$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^predict$/i })).not.toBeDisabled()
    })

    expect(screen.queryByText('PREDICTED WEIGHT')).not.toBeInTheDocument()
  })

  it('form includes time-of-day dropdown with all options', async () => {
    renderWithClient(<WeightLog />)
    await waitFor(() => {
      expect(screen.getByText('TIME OF DAY')).toBeInTheDocument()
    })
    // Dropdown has the 4 options + disabled placeholder
    expect(screen.getByText('— Select —')).toBeInTheDocument()
    expect(screen.getByText('Morning')).toBeInTheDocument()
    expect(screen.getByText('Before Practice')).toBeInTheDocument()
    expect(screen.getByText('After Practice')).toBeInTheDocument()
    expect(screen.getByText('Night')).toBeInTheDocument()
  })

  it('chart title shows DAILY AVERAGE with day count', async () => {
    renderWithClient(<WeightLog />)
    await waitFor(() => {
      // LOGS has entries on 3 unique dates (Mar 28, 29, 30), so chart shows 3 days
      expect(screen.getByText(/DAILY AVERAGE — LAST 3 DAYS/)).toBeInTheDocument()
    })
  })

  it('error path — shows load error when Supabase fails', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: null, error: { message: 'Query failed' } }),
      insert: () => Promise.resolve({ error: null }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    })

    renderWithClient(<WeightLog />)
    await waitFor(() => {
      expect(screen.getByText(/Query failed/)).toBeInTheDocument()
    })
  })

  it('auth — returns early if no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<WeightLog />)
    // With no session, uid stays null, query is disabled (enabled: !!uid)
    // Should not show loading indefinitely
    await waitFor(() => {
      expect(screen.getByText('WEIGHT LOG')).toBeInTheDocument()
    })
    // No chart because no data fetched
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })
})
