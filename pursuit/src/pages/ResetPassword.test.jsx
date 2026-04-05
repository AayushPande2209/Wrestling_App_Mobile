import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from './ResetPassword'

// ---------- Navigate mock ----------
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------- Supabase mock ----------
let authChangeCallback = null
const mockUpdateUser = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb) => {
        authChangeCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      updateUser: (...args) => mockUpdateUser(...args),
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  authChangeCallback = null
  mockUpdateUser.mockResolvedValue({ error: null })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>
  )
}

// ---------- Tests ----------
describe('ResetPassword', () => {
  it('renders verifying state before PASSWORD_RECOVERY event', () => {
    renderPage()
    expect(screen.getByText('Verifying reset link...')).toBeInTheDocument()
    expect(screen.getByText('SET NEW PASSWORD')).toBeInTheDocument()
    // Form should not be visible yet
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
  })

  it('shows form after PASSWORD_RECOVERY event', async () => {
    renderPage()
    expect(screen.getByText('Verifying reset link...')).toBeInTheDocument()

    // Simulate Supabase firing the recovery event
    authChangeCallback('PASSWORD_RECOVERY')

    await waitFor(() => {
      expect(screen.queryByText('Verifying reset link...')).not.toBeInTheDocument()
    })
    expect(screen.getByText('NEW PASSWORD')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set password/i })).toBeInTheDocument()
  })

  it('happy path — submits new password and navigates to dashboard', async () => {
    const user = userEvent.setup()
    renderPage()

    authChangeCallback('PASSWORD_RECOVERY')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /set password/i })).toBeInTheDocument()
    })

    await user.type(document.querySelector('input[type="password"]'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass123' })
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('error path — shows error when updateUser fails', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: { message: 'Password too weak' } })
    const user = userEvent.setup()
    renderPage()

    authChangeCallback('PASSWORD_RECOVERY')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /set password/i })).toBeInTheDocument()
    })

    await user.type(document.querySelector('input[type="password"]'), 'short')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(screen.getByText('Password too weak')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('ignores non-recovery auth events', () => {
    renderPage()

    // Fire a different event — should not show the form
    authChangeCallback('SIGNED_IN')

    expect(screen.getByText('Verifying reset link...')).toBeInTheDocument()
  })
})
