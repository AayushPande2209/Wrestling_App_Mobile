import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

// ---------- Supabase mock ----------
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => {
        mockOnAuthStateChange(...args)
        return {
          data: {
            subscription: { unsubscribe: vi.fn() },
          },
        }
      },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function renderProtected(session) {
  mockGetSession.mockResolvedValue({ data: { session } })

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/auth" element={<div>AUTH PAGE</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>PROTECTED CONTENT</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

// ---------- Tests ----------
describe('ProtectedRoute', () => {
  it('renders without crashing — shows loading initially', () => {
    // Never resolve to test loading state
    mockGetSession.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <ProtectedRoute><div>CHILD</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.getByText('LOADING...')).toBeInTheDocument()
  })

  it('happy path — renders children when session exists', async () => {
    renderProtected({ user: { id: 'uid-1' }, access_token: 'jwt' })

    await waitFor(() => {
      expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument()
    })
  })

  it('auth — redirects to /auth when no session', async () => {
    renderProtected(null)

    await waitFor(() => {
      expect(screen.getByText('AUTH PAGE')).toBeInTheDocument()
    })
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument()
  })

  it('subscribes to auth state changes', async () => {
    renderProtected({ user: { id: 'uid-1' }, access_token: 'jwt' })

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
    })
  })
})
