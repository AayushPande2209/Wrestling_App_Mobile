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

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args) => mockSignUp(...args),
      signInWithPassword: (...args) => mockSignIn(...args),
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
  mockSignUp.mockResolvedValue({ data: { user: { id: 'new-uid' } }, error: null })
  mockSignIn.mockResolvedValue({ data: {}, error: null })
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
      expect(mockInsert).toHaveBeenCalledWith({ id: 'new-uid', email: 'new@team.edu', name: null })
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
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
})
