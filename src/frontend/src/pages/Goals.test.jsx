import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Goals from './Goals'

// ---------- Mock data ----------
const TODAY = new Date().toISOString().split('T')[0]

const ACTIVE_GOALS = [
  {
    id: 'g1', goal_type: 'lifting', tracking_type: 'auto',
    description: 'Lift 3x per week', target: 3, progress: 0,
    target_date: null, tournament_id: null,
    completed: false, completed_at: null, created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 'g2', goal_type: 'habit', tracking_type: 'auto',
    description: 'Morning run', target: 5, progress: 0,
    target_date: null, tournament_id: null,
    completed: false, completed_at: null, created_at: '2026-04-01T11:00:00Z',
  },
  {
    id: 'g3', goal_type: 'other', tracking_type: 'manual',
    description: 'Improve stance', target: null, progress: 50,
    target_date: '2026-06-01', tournament_id: null,
    completed: false, completed_at: null, created_at: '2026-04-01T12:00:00Z',
  },
]

const PAST_GOALS = [
  {
    id: 'g4', goal_type: 'lifting', tracking_type: 'auto',
    description: 'Old lifting goal', target: 2, progress: 100,
    target_date: '2026-03-01', tournament_id: null,
    completed: true, completed_at: '2026-03-01T10:00:00Z', created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'g5', goal_type: 'other', tracking_type: 'manual',
    description: 'Missed deadline goal', target: null, progress: 30,
    target_date: '2026-03-15', tournament_id: null,
    completed: false, completed_at: null, created_at: '2026-02-15T10:00:00Z',
  },
]

const ALL_GOALS = [...ACTIVE_GOALS, ...PAST_GOALS]

const TOURNAMENTS = [
  { id: 't1', name: 'State Championships', date: '2026-05-15' },
]

// ---------- Supabase mock ----------
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

function makeBuilder(resolveValue) {
  const b = {
    select: () => b,
    single: () => b,
    eq: () => b,
    order: () => b,
    gte: () => b,
    lte: () => b,
    then: (resolve, reject) => Promise.resolve(resolveValue).then(resolve, reject),
  }
  return b
}

function makeDefaultFrom() {
  return (table) => ({
    select: () => {
      if (table === 'goals') return makeBuilder({ data: ALL_GOALS, error: null })
      if (table === 'tournaments') return makeBuilder({ data: TOURNAMENTS, error: null })
      if (table === 'workouts') return makeBuilder({ data: [{ id: 'w1' }, { id: 'w2' }], error: null })
      if (table === 'schedules') return makeBuilder({ data: [{ id: 's1' }], error: null })
      if (table === 'habit_logs') return makeBuilder({ data: [], error: null })
      return makeBuilder({ data: [], error: null })
    },
    insert: (payload) => {
      mockInsert(table, payload)
      return Promise.resolve({ error: null })
    },
    update: (payload) => {
      mockUpdate(table, payload)
      return { eq: () => Promise.resolve({ error: null }) }
    },
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
})

// ---------- Tests ----------
describe('Goals', () => {
  it('renders without crashing and shows form', async () => {
    renderWithClient(<Goals />)
    await waitFor(() => {
      expect(screen.getByText('GOALS')).toBeInTheDocument()
    })
    // "ADD GOAL" appears as both form title and submit button
    expect(screen.getByRole('button', { name: /add goal/i })).toBeInTheDocument()
  })

  it('shows active and past goals', async () => {
    renderWithClient(<Goals />)
    await waitFor(() => {
      expect(screen.getByText('Lift 3x per week')).toBeInTheDocument()
    })
    expect(screen.getByText('Morning run')).toBeInTheDocument()
    expect(screen.getByText('Improve stance')).toBeInTheDocument()
    // Past goals section
    expect(screen.getByText('PAST GOALS')).toBeInTheDocument()
    expect(screen.getByText('Old lifting goal')).toBeInTheDocument()
    expect(screen.getByText('Missed deadline goal')).toBeInTheDocument()
  })

  it('past goals show COMPLETED and MISSED badges', async () => {
    renderWithClient(<Goals />)
    await waitFor(() => {
      expect(screen.getByText('Old lifting goal')).toBeInTheDocument()
    })
    // g4 is completed
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThanOrEqual(1)
    // g5 is missed (target_date in past, not completed)
    expect(screen.getByText('MISSED')).toBeInTheDocument()
  })

  it('auto-tracking — lifting goal computes progress from workouts', async () => {
    renderWithClient(<Goals />)
    await waitFor(() => {
      expect(screen.getByText('Lift 3x per week')).toBeInTheDocument()
    })
    // weekWorkouts has 2 items, target is 3 → 67%
    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('habit goal shows LOG TODAY button', async () => {
    renderWithClient(<Goals />)
    await waitFor(() => {
      expect(screen.getByText('Morning run')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /log today/i })).toBeInTheDocument()
  })

  it('manual goal shows MARK COMPLETE button', async () => {
    renderWithClient(<Goals />)
    await waitFor(() => {
      expect(screen.getByText('Improve stance')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeInTheDocument()
  })

  it('happy path — add goal inserts with correct tracking type', async () => {
    const user = userEvent.setup()
    renderWithClient(<Goals />)

    await waitFor(() => {
      expect(screen.getByText('GOALS')).toBeInTheDocument()
    })

    // Fill in form — goal_type defaults to 'lifting'
    await user.type(screen.getByPlaceholderText('e.g. Lift 3x per week'), 'Squat 4x/week')
    await user.type(screen.getByPlaceholderText('e.g. 3'), '4')
    await user.click(screen.getByRole('button', { name: /add goal/i }))

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith('goals', expect.objectContaining({
        goal_type: 'lifting',
        tracking_type: 'auto',
        description: 'Squat 4x/week',
        target: 4,
        wrestler_id: 'uid-1',
      }))
    })
  })

  it('form — goal type dropdown shows all 5 options', async () => {
    renderWithClient(<Goals />)
    await waitFor(() => {
      expect(screen.getByText('GOALS')).toBeInTheDocument()
    })
    expect(screen.getByText('Lifting (auto)')).toBeInTheDocument()
    expect(screen.getByText('Practice Attendance (auto)')).toBeInTheDocument()
    expect(screen.getByText('Daily Habit (auto)')).toBeInTheDocument()
    expect(screen.getByText('Tournament Placement (manual)')).toBeInTheDocument()
    expect(screen.getByText('Other (manual)')).toBeInTheDocument()
  })

  it('delete confirmation dialog appears', async () => {
    const user = userEvent.setup()
    renderWithClient(<Goals />)

    await waitFor(() => {
      expect(screen.getByText('Lift 3x per week')).toBeInTheDocument()
    })

    // Click DELETE on first active goal
    const deleteButtons = screen.getAllByText('DELETE')
    await user.click(deleteButtons[0])

    // Confirmation dialog
    expect(screen.getByText('DELETE GOAL')).toBeInTheDocument()
    expect(screen.getByText(/permanently delete the goal/)).toBeInTheDocument()

    // Cancel
    await user.click(screen.getByText('CANCEL'))
    expect(screen.queryByText('DELETE GOAL')).not.toBeInTheDocument()
  })

  it('auth — shows empty when no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<Goals />)

    await waitFor(() => {
      expect(screen.getByText('GOALS')).toBeInTheDocument()
    })
    expect(screen.getByText('No active goals. Add one above.')).toBeInTheDocument()
  })
})
