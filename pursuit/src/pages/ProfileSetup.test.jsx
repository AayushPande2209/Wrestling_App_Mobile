import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ProfileSetup from './ProfileSetup'

// ---------- Navigate mock ----------
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------- Supabase mock ----------
const mockGetSession = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
    },
    from: () => ({
      select: (...args) => {
        mockSelect(...args)
        return {
          eq: () => ({
            single: () => Promise.resolve({
              data: { name: 'test@team.edu', email: 'test@team.edu' },
              error: null,
            }),
          }),
        }
      },
      update: (payload) => {
        mockUpdate(payload)
        return {
          eq: () => Promise.resolve({ error: null }),
        }
      },
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'uid-1' } } },
  })
})

function renderSetup() {
  return render(
    <MemoryRouter>
      <ProfileSetup />
    </MemoryRouter>
  )
}

// ---------- Tests ----------
describe('ProfileSetup', () => {
  it('renders without crashing — shows setup form', async () => {
    renderSetup()
    await waitFor(() => {
      expect(screen.getByText('Set up your profile')).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('152')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
    expect(screen.getByText('Skip for now')).toBeInTheDocument()
  })

  it('happy path — submits name and weight class, navigates to dashboard', async () => {
    const user = userEvent.setup()
    renderSetup()

    await waitFor(() => {
      expect(screen.getByText('Set up your profile')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Your name'), 'John Doe')
    await user.type(screen.getByPlaceholderText('152'), '157')
    await user.click(screen.getByRole('button', { name: /get started/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ name: 'John Doe', weight_class: 157 })
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('happy path — submits name only (no weight class)', async () => {
    const user = userEvent.setup()
    renderSetup()

    await waitFor(() => {
      expect(screen.getByText('Set up your profile')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Your name'), 'Jane Smith')
    await user.click(screen.getByRole('button', { name: /get started/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ name: 'Jane Smith' })
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('skip link navigates to dashboard without saving', async () => {
    const user = userEvent.setup()
    renderSetup()

    await waitFor(() => {
      expect(screen.getByText('Skip for now')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Skip for now'))

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('redirects to dashboard if wrestler already has a real name', async () => {
    // Override the select mock to return a real name (different from email)
    const originalFrom = vi.mocked(() => {})
    const { supabase } = await import('../lib/supabase')
    const origFrom = supabase.from
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { name: 'Already Set', email: 'test@team.edu' },
            error: null,
          }),
        }),
      }),
      update: (payload) => {
        mockUpdate(payload)
        return { eq: () => Promise.resolve({ error: null }) }
      },
    })

    renderSetup()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })

    // Restore
    supabase.from = origFrom
  })

  it('redirects to auth if no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })
    renderSetup()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth', { replace: true })
    })
  })

  it('error path — shows error when update fails', async () => {
    const { supabase } = await import('../lib/supabase')
    const origFrom = supabase.from
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { name: 'test@team.edu', email: 'test@team.edu' },
            error: null,
          }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: { message: 'Update failed' } }),
      }),
    })

    const user = userEvent.setup()
    renderSetup()

    await waitFor(() => {
      expect(screen.getByText('Set up your profile')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Your name'), 'Test')
    await user.click(screen.getByRole('button', { name: /get started/i }))

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })

    supabase.from = origFrom
  })
})
