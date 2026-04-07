import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Workouts from './Workouts'

// ---------- Mock data ----------
const WORKOUTS = [
  { id: 'w1', workout_date: '2026-04-01', notes: 'heavy day', created_at: '2026-04-01T10:00:00Z' },
  { id: 'w2', workout_date: '2026-04-03', notes: null, created_at: '2026-04-03T10:00:00Z' },
]

const EXERCISES = [
  { id: 'e1', name: 'Squat', sets: 5, reps: 5, weight: 225 },
  { id: 'e2', name: 'Bench Press', sets: 3, reps: 8, weight: 185 },
]

// ---------- Supabase mock ----------
const mockRpc = vi.fn()
const mockDelete = vi.fn()

function makeBuilder(resolveValue) {
  const b = {
    select: () => b,
    single: () => b,
    eq: () => b,
    order: () => b,
    range: () => b,
    then: (resolve, reject) => Promise.resolve(resolveValue).then(resolve, reject),
  }
  return b
}

function makeDefaultFrom() {
  return (table) => ({
    select: () => {
      if (table === 'workout_exercises') {
        return makeBuilder({ data: EXERCISES, error: null })
      }
      return makeBuilder({ data: WORKOUTS, error: null })
    },
    insert: () => makeBuilder({ error: null }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => {
      mockDelete(table)
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
      rpc: (...args) => mockRpc(...args),
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
  supabase.from = makeDefaultFrom()
  mockRpc.mockResolvedValue({ data: 'new-workout-id', error: null })
})

// ---------- Tests ----------
describe('Workouts', () => {
  it('renders without crashing and shows form', async () => {
    renderWithClient(<Workouts />)
    await waitFor(() => {
      expect(screen.getByText('WORKOUTS')).toBeInTheDocument()
    })
    expect(screen.getByText('EXERCISES')).toBeInTheDocument()
    // "LOG WORKOUT" appears as both form title and submit button
    expect(screen.getByRole('button', { name: /log workout/i })).toBeInTheDocument()
  })

  it('happy path — shows past workouts list', async () => {
    renderWithClient(<Workouts />)
    await waitFor(() => {
      expect(screen.getByText('heavy day')).toBeInTheDocument()
    })
    expect(screen.getByText('PAST WORKOUTS')).toBeInTheDocument()
  })

  it('happy path — log workout calls RPC', async () => {
    const user = userEvent.setup()
    renderWithClient(<Workouts />)

    await waitFor(() => {
      expect(screen.getByText('WORKOUTS')).toBeInTheDocument()
    })

    // Fill in exercise row — dual layout (hidden md:block / block md:hidden)
    // renders both desktop table + mobile card in jsdom, so numeric
    // placeholders appear twice. Target the desktop table inputs ([0]).
    await user.type(screen.getByPlaceholderText('Squat'), 'Deadlift')
    await user.type(screen.getAllByPlaceholderText('3')[0], '4')
    await user.type(screen.getAllByPlaceholderText('5')[0], '6')
    await user.type(screen.getAllByPlaceholderText('135')[0], '315')

    await user.click(screen.getByRole('button', { name: /log workout/i }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('insert_lifting_workout', expect.objectContaining({
        p_exercises: expect.arrayContaining([
          expect.objectContaining({ name: 'Deadlift' }),
        ]),
      }))
    })
  })

  it('validation — requires at least one exercise with a name', async () => {
    const user = userEvent.setup()
    renderWithClient(<Workouts />)

    await waitFor(() => {
      expect(screen.getByText('WORKOUTS')).toBeInTheDocument()
    })

    // Submit with empty exercise row
    await user.click(screen.getByRole('button', { name: /log workout/i }))

    await waitFor(() => {
      expect(screen.getByText('Add at least one exercise with a name.')).toBeInTheDocument()
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('expand workout shows exercises on demand', async () => {
    renderWithClient(<Workouts />)

    await waitFor(() => {
      expect(screen.getByText('heavy day')).toBeInTheDocument()
    })

    // Click the first workout row to expand
    const user = userEvent.setup()
    await user.click(screen.getByText('heavy day'))

    await waitFor(() => {
      expect(screen.getByText('Squat')).toBeInTheDocument()
      expect(screen.getByText('Bench Press')).toBeInTheDocument()
      expect(screen.getByText('225 lbs')).toBeInTheDocument()
    })
  })

  it('delete confirmation dialog appears and works', async () => {
    const user = userEvent.setup()
    renderWithClient(<Workouts />)

    await waitFor(() => {
      expect(screen.getByText('heavy day')).toBeInTheDocument()
    })

    // Click DELETE on first workout
    const deleteButtons = screen.getAllByText('DELETE')
    await user.click(deleteButtons[0])

    // Confirmation dialog appears
    expect(screen.getByText('DELETE WORKOUT')).toBeInTheDocument()
    expect(screen.getByText(/permanently delete/)).toBeInTheDocument()

    // Click cancel
    await user.click(screen.getByText('CANCEL'))
    expect(screen.queryByText('DELETE WORKOUT')).not.toBeInTheDocument()
  })

  it('add/remove exercise rows', async () => {
    const user = userEvent.setup()
    renderWithClient(<Workouts />)

    await waitFor(() => {
      expect(screen.getByText('WORKOUTS')).toBeInTheDocument()
    })

    // Initially 1 row
    expect(screen.getAllByPlaceholderText('Squat')).toHaveLength(1)

    // Add a row
    await user.click(screen.getByText('+ ADD ROW'))
    expect(screen.getAllByPlaceholderText('Squat')).toHaveLength(2)

    // Remove a row (click ✕)
    const removeButtons = screen.getAllByText('✕')
    await user.click(removeButtons[0])
    expect(screen.getAllByPlaceholderText('Squat')).toHaveLength(1)
  })

  it('error path — shows error when RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC failed' } })
    const user = userEvent.setup()
    renderWithClient(<Workouts />)

    await waitFor(() => {
      expect(screen.getByText('WORKOUTS')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Squat'), 'Deadlift')
    await user.click(screen.getByRole('button', { name: /log workout/i }))

    await waitFor(() => {
      expect(screen.getByText('RPC failed')).toBeInTheDocument()
    })
  })

  it('error path — shows error when workouts load fails', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: null, error: { message: 'Load error' } }),
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    })

    renderWithClient(<Workouts />)
    await waitFor(() => {
      expect(screen.getByText('Load error')).toBeInTheDocument()
    })
  })

  it('auth — shows empty when no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<Workouts />)

    await waitFor(() => {
      expect(screen.getByText('WORKOUTS')).toBeInTheDocument()
    })
    // No workouts loaded
    expect(screen.getByText('No workouts logged yet.')).toBeInTheDocument()
  })
})
