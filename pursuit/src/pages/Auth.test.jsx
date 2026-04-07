import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Auth from './Auth'

// ---------- Navigate mock ----------
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------- Supabase mock ----------
const mockSignUp = vi.fn()
const mockSignIn = vi.fn()
const mockInsert = vi.fn()
const mockResetPassword = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args) => mockSignUp(...args),
      signInWithPassword: (...args) => mockSignIn(...args),
      resetPasswordForEmail: (...args) => mockResetPassword(...args),
    },
    from: () => ({
      insert: (payload) => {
        mockInsert(payload)
        return Promise.resolve({ error: null })
      },
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSignUp.mockResolvedValue({
    data: { user: { id: 'new-uid', identities: [{ id: 'id-1' }] } },
    error: null,
  })
  mockSignIn.mockResolvedValue({ data: {}, error: null })
  mockResetPassword.mockResolvedValue({ error: null })
})

function renderAuth() {
  return render(
    <MemoryRouter>
      <Auth />
    </MemoryRouter>
  )
}

// Helper: find the submit button (type="submit")
function getSubmitButton() {
  return document.querySelector('button[type="submit"]')
}

// Helper: find the password input
function getPasswordInput() {
  return document.querySelector('input[type="password"]')
}

// ---------- Tests ----------
describe('Auth', () => {
  it('renders without crashing — shows sign in form by default', () => {
    renderAuth()
    expect(screen.getByText('PURSUIT')).toBeInTheDocument()
    expect(getSubmitButton().textContent).toBe('SIGN IN')
    expect(screen.getByPlaceholderText('wrestler@team.edu')).toBeInTheDocument()
  })

  it('toggles between sign in and sign up', async () => {
    const user = userEvent.setup()
    renderAuth()

    expect(getSubmitButton().textContent).toBe('SIGN IN')

    // Click the SIGN UP tab
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    expect(getSubmitButton().textContent).toBe('CREATE ACCOUNT')
  })

  it('happy path — sign in calls signInWithPassword and navigates', async () => {
    const user = userEvent.setup()
    renderAuth()

    await user.type(screen.getByPlaceholderText('wrestler@team.edu'), 'test@team.edu')
    await user.type(getPasswordInput(), 'password123')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@team.edu',
        password: 'password123',
      })
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('happy path — sign up calls signUp, inserts wrestler row, and navigates', async () => {
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    await user.type(screen.getByPlaceholderText('wrestler@team.edu'), 'new@team.edu')
    await user.type(getPasswordInput(), 'password123')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@team.edu',
        password: 'password123',
      })
      expect(mockInsert).toHaveBeenCalledWith({ id: 'new-uid', email: 'new@team.edu', name: 'new@team.edu' })
      expect(mockNavigate).toHaveBeenCalledWith('/profile/setup')
    })
  })

  it('error path — shows error message on sign in failure', async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } })
    const user = userEvent.setup()
    renderAuth()

    await user.type(screen.getByPlaceholderText('wrestler@team.edu'), 'bad@team.edu')
    await user.type(getPasswordInput(), 'wrong')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('error path — shows error message on sign up failure', async () => {
    mockSignUp.mockResolvedValueOnce({ data: {}, error: { message: 'Email taken' } })
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    await user.type(screen.getByPlaceholderText('wrestler@team.edu'), 'taken@team.edu')
    await user.type(getPasswordInput(), 'password123')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText('Email taken')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('loading state — disables submit button while loading', async () => {
    mockSignIn.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderAuth()

    await user.type(screen.getByPlaceholderText('wrestler@team.edu'), 'test@team.edu')
    await user.type(getPasswordInput(), 'password123')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(getSubmitButton()).toBeDisabled()
      expect(getSubmitButton().textContent).toBe('LOADING...')
    })
  })

  it('duplicate email — shows error when identities is empty', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: 'fake-uid', identities: [] } },
      error: null,
    })
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    await user.type(screen.getByPlaceholderText('wrestler@team.edu'), 'existing@team.edu')
    await user.type(getPasswordInput(), 'password123')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(
        screen.getByText(/An account with this email already exists/)
      ).toBeInTheDocument()
    })
    // Should not insert wrestler row or navigate
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('forgot password — link appears on sign-in tab only', async () => {
    const user = userEvent.setup()
    renderAuth()

    // Visible on sign-in tab
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()

    // Switch to sign-up tab — link should disappear
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument()
  })

  it('forgot password — shows reset form and hides tabs', async () => {
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByText('Forgot password?'))

    // Tabs should be hidden
    expect(screen.queryByRole('button', { name: /^sign in$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sign up$/i })).not.toBeInTheDocument()

    // Reset UI visible
    expect(screen.getByText('RESET PASSWORD')).toBeInTheDocument()
    expect(screen.getByText(/BACK TO SIGN IN/)).toBeInTheDocument()
    expect(getSubmitButton().textContent).toBe('SEND RESET LINK')

    // Password field hidden
    expect(getPasswordInput()).toBeNull()
  })

  it('forgot password — sends reset email and shows confirmation', async () => {
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByText('Forgot password?'))
    await user.type(screen.getByPlaceholderText('wrestler@team.edu'), 'me@team.edu')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('me@team.edu', {
        redirectTo: expect.stringContaining('/reset-password'),
      })
      expect(screen.getByText('Check your email for a reset link.')).toBeInTheDocument()
    })
    // Submit button should be replaced by confirmation
    expect(getSubmitButton()).toBeNull()
  })

  it('forgot password — back to sign in restores login form', async () => {
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByText('Forgot password?'))
    expect(screen.getByText('RESET PASSWORD')).toBeInTheDocument()

    await user.click(screen.getByText(/BACK TO SIGN IN/))

    // Tabs visible again — "SIGN IN" appears as both tab and submit button
    expect(screen.getAllByRole('button', { name: /^sign in$/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument()
    expect(getSubmitButton().textContent).toBe('SIGN IN')
  })

  it('forgot password — shows error on failure', async () => {
    mockResetPassword.mockResolvedValueOnce({ error: { message: 'Rate limit exceeded' } })
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByText('Forgot password?'))
    await user.type(screen.getByPlaceholderText('wrestler@team.edu'), 'me@team.edu')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
    })
  })
})
