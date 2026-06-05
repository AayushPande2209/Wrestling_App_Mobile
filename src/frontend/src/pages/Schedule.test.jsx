import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Schedule from './Schedule'

// ---------- Mock data ----------
const FUTURE_EVENT = {
  id: 'e1',
  title: 'Regional Qualifier',
  event_type: 'tournament',
  starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  ends_at: null,
  location: 'Fieldhouse B',
}
const PAST_EVENT = {
  id: 'e2',
  title: 'Monday Practice',
  event_type: 'practice',
  starts_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  ends_at: null,
  location: null,
}

// ---------- Supabase mock ----------
const mockInsert = vi.fn()

function makeBuilder(resolveValue) {
  const b = {
    select: () => b,
    eq: () => b,
    gt: () => b,
    lte: () => b,
    order: () => b,
    range: () => b,
    then: (resolve, reject) => Promise.resolve(resolveValue).then(resolve, reject),
  }
  return b
}

function makeDefaultFrom() {
  return () => {
    // Both upcoming and past queries go through the same chain.
    // We return both events — the component uses .gt/.lte on Supabase side,
    // but in the mock both resolve to data that includes both events.
    // The component separates them via the gt/lte filters. In our mock,
    // we route upcoming to FUTURE_EVENT and past to PAST_EVENT.
    return {
      select: () => ({
        eq: () => ({
          gt: () => makeBuilder({ data: [FUTURE_EVENT], error: null }),
          lte: () => makeBuilder({ data: [PAST_EVENT], error: null }),
        }),
      }),
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

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert._result = undefined
  supabase.from = makeDefaultFrom()
})

// ---------- Tests ----------
describe('Schedule', () => {
  it('renders without crashing and shows events', async () => {
    renderWithClient(<Schedule />)
    await waitFor(() => {
      expect(screen.getByText('Regional Qualifier')).toBeInTheDocument()
    })
    expect(screen.getByText('SCHEDULE')).toBeInTheDocument()
    expect(screen.getByText('Monday Practice')).toBeInTheDocument()
  })

  it('happy path — separates upcoming and past events', async () => {
    renderWithClient(<Schedule />)
    await waitFor(() => {
      expect(screen.getByText(/UPCOMING/)).toBeInTheDocument()
      expect(screen.getByText(/PAST/)).toBeInTheDocument()
    })
  })

  it('validation — rejects end time before start time', async () => {
    const user = userEvent.setup()
    renderWithClient(<Schedule />)

    // Wait for data to fully load before interacting with form
    await waitFor(() => {
      expect(screen.getByText('Regional Qualifier')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Regional Qualifier'), 'Test Event')

    const form = document.querySelector('form')
    const startInput = form.querySelectorAll('input[type="datetime-local"]')[0]
    const endInput = form.querySelectorAll('input[type="datetime-local"]')[1]

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(startInput, '2026-04-10T10:00')
    startInput.dispatchEvent(new Event('input', { bubbles: true }))
    startInput.dispatchEvent(new Event('change', { bubbles: true }))

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(endInput, '2026-04-10T08:00')
    endInput.dispatchEvent(new Event('input', { bubbles: true }))
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    await user.click(screen.getByRole('button', { name: /add event/i }))

    await waitFor(() => {
      expect(screen.getByText('End time must be after start time.')).toBeInTheDocument()
    })

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('error path — shows error when Supabase load fails', async () => {
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          gt: () => makeBuilder({ data: null, error: { message: 'Schedule load error' } }),
          lte: () => makeBuilder({ data: null, error: { message: 'Schedule load error' } }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    })

    renderWithClient(<Schedule />)
    await waitFor(() => {
      expect(screen.getByText(/Failed to load upcoming events/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('auth — returns early if no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<Schedule />)
    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).not.toBeInTheDocument()
    })
  })
})
