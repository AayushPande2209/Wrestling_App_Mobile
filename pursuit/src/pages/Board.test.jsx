import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Board from './Board'

// ---------- Mock data ----------
const WRESTLERS = [
  { id: 'w1', name: 'Alice', current_weight: 155.0, weight_class: 152 },
  { id: 'w2', name: 'Bob', current_weight: 150.0, weight_class: 152 },
  { id: 'w3', name: null, current_weight: null, weight_class: null },
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
    select: () => makeBuilder({ data: WRESTLERS, error: null }),
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
describe('Board', () => {
  it('renders without crashing and shows board', async () => {
    renderWithClient(<Board />)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    expect(screen.getByText('TEAM BOARD')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows ON WEIGHT for wrestlers at or below weight class', async () => {
    renderWithClient(<Board />)
    await waitFor(() => {
      expect(screen.getByText('ON WEIGHT')).toBeInTheDocument()
    })
  })

  it('shows lbs to cut for wrestlers over weight class', async () => {
    renderWithClient(<Board />)
    await waitFor(() => {
      // Alice: 155 - 152 = 3.0
      expect(screen.getByText('3.0 LBS')).toBeInTheDocument()
    })
  })

  it('shows dashes for wrestler with no name/weight', async () => {
    renderWithClient(<Board />)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    // w3 has null name, null weight_class, null current_weight
    // Should show "—" in multiple places
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(3) // name + class + to cut for w3
  })

  it('shows empty state when no opted-in wrestlers', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: [], error: null }),
    })

    renderWithClient(<Board />)
    await waitFor(() => {
      expect(screen.getByText(/No wrestlers have opted in/)).toBeInTheDocument()
    })
  })

  it('error path — shows error when Supabase fails', async () => {
    supabase.from = () => ({
      select: () => makeBuilder({ data: null, error: { message: 'Board load error' } }),
    })

    renderWithClient(<Board />)
    await waitFor(() => {
      expect(screen.getByText(/Board load error/)).toBeInTheDocument()
    })
  })

  it('auth — no crash if no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    renderWithClient(<Board />)
    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).not.toBeInTheDocument()
    })
  })
})
