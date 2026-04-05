import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Notes from './Notes'

// ---------- Mock data ----------
const NOTES_LIST = [
  {
    id: 'n1',
    body: 'Worked on single legs today.',
    context: 'practice',
    match_id: null,
    created_at: '2026-03-30T15:00:00Z',
  },
  {
    id: 'n2',
    body: 'Good scramble finish.',
    context: 'match',
    match_id: 'm1',
    created_at: '2026-03-29T12:00:00Z',
  },
]

const ALL_MATCHES = [
  { id: 'm1', opponent_name: 'Smith, John', match_date: '2026-03-15' },
  { id: 'm2', opponent_name: 'Jones, Mike', match_date: '2026-03-10' },
  { id: 'm3', opponent_name: 'Brown, Chris', match_date: '2026-02-20' },
  { id: 'm4', opponent_name: 'Davis, Pat', match_date: '2026-02-01' },
  { id: 'm5', opponent_name: 'Wilson, Sam', match_date: '2026-01-15' },
  { id: 'm6', opponent_name: 'Taylor, Alex', match_date: '2026-01-05' },
  { id: 'm7', opponent_name: 'Clark, Dan', match_date: '2025-12-20' },
  { id: 'm8', opponent_name: 'Hall, Tom', match_date: '2025-12-10' },
  { id: 'm9', opponent_name: 'Allen, Joe', match_date: '2025-11-25' },
  { id: 'm10', opponent_name: 'King, Lee', match_date: '2025-11-15' },
  { id: 'm11', opponent_name: 'Scott, Ben', match_date: '2025-11-01' },
  { id: 'm12', opponent_name: 'Adams, Ray', match_date: '2025-10-20' },
]

// ---------- Supabase mock ----------
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
  return (table) => ({
    select: () => {
      if (table === 'notes') {
        return makeBuilder({ data: NOTES_LIST, error: null })
      }
      // matches — returns ALL matches for dropdown
      return makeBuilder({ data: ALL_MATCHES, error: null })
    },
    insert: () => Promise.resolve({ error: null }),
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
describe('Notes', () => {
  it('renders without crashing and shows notes', async () => {
    renderWithClient(<Notes />)
    await waitFor(() => {
      expect(screen.getByText('Worked on single legs today.')).toBeInTheDocument()
    })
    expect(screen.getByText('NOTES')).toBeInTheDocument()
    expect(screen.getByText('Good scramble finish.')).toBeInTheDocument()
  })

  it('happy path — filter by context works', async () => {
    const user = userEvent.setup()
    renderWithClient(<Notes />)

    await waitFor(() => {
      expect(screen.getByText('Worked on single legs today.')).toBeInTheDocument()
    })

    // Filter to match only
    await user.click(screen.getByRole('button', { name: 'MATCH' }))

    expect(screen.queryByText('Worked on single legs today.')).not.toBeInTheDocument()
    expect(screen.getByText('Good scramble finish.')).toBeInTheDocument()
  })

  it('match dropdown shows ALL matches (not limited to 10)', async () => {
    renderWithClient(<Notes />)

    // Wait for data to fully load (notes + matches dropdown)
    await waitFor(() => {
      expect(screen.getByText(/Scott, Ben/)).toBeInTheDocument()
    })

    // All 12 matches should appear as options — check the ones beyond index 10
    expect(screen.getByText(/Adams, Ray/)).toBeInTheDocument()
  })

  it('error path — shows error when Supabase load fails', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: null, error: { message: 'Notes load error' } }),
      insert: () => Promise.resolve({ error: null }),
    })

    renderWithClient(<Notes />)
    await waitFor(() => {
      expect(screen.getByText(/Notes load error/)).toBeInTheDocument()
    })
  })

  it('auth — returns early if no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<Notes />)
    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).not.toBeInTheDocument()
    })
  })
})
