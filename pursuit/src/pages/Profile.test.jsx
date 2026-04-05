import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Profile from './Profile'

// ---------- Supabase mock ----------
const mockSelect = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../lib/supabase', () => {
  const fromFn = (table) => ({
    select: (...args) => {
      mockSelect(...args)
      return {
        eq: () => ({
          single: () =>
            mockSelect._result ?? {
              data: { email: 'test@team.edu', name: 'Test Wrestler', weight_class: 152, show_on_board: false },
              error: null,
            },
        }),
      }
    },
    update: (payload) => {
      mockUpdate(payload)
      return {
        eq: () =>
          mockUpdate._result ?? { data: null, error: null },
      }
    },
  })

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'wrestler-uuid-123' } } },
        }),
      },
      from: fromFn,
    },
  }
})

// Re-import to get a handle for per-test overrides
import { supabase } from '../lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  mockSelect._result = undefined
  mockUpdate._result = undefined
})

// ---------- Tests ----------

describe('Profile', () => {
  it('renders without crashing and shows the form after loading', async () => {
    render(<Profile />)

    // Loading state appears first
    expect(screen.getByText('LOADING...')).toBeInTheDocument()

    // After load, form fields appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText('152')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('happy path — loads wrestler data and populates form', async () => {
    render(<Profile />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Your name')).toHaveValue('Test Wrestler')
    })
    expect(screen.getByPlaceholderText('152')).toHaveValue(152)
  })

  it('happy path — submits updated profile', async () => {
    const user = userEvent.setup()
    render(<Profile />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Your name')).toHaveValue('Test Wrestler')
    })

    const nameInput = screen.getByPlaceholderText('Your name')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Profile saved.')).toBeInTheDocument()
    })

    expect(mockUpdate).toHaveBeenCalledWith({
      name: 'New Name',
      weight_class: 152,
      show_on_board: false,
    })
  })

  it('error path — shows error when load fails', async () => {
    mockSelect._result = { data: null, error: { message: 'Row not found' } }

    render(<Profile />)

    await waitFor(() => {
      expect(screen.getByText('Row not found')).toBeInTheDocument()
    })

    // Form should NOT render when load fails
    expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument()
  })

  it('error path — shows error when save fails', async () => {
    mockUpdate._result = { data: null, error: { message: 'Update denied' } }

    const user = userEvent.setup()
    render(<Profile />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Your name')).toHaveValue('Test Wrestler')
    })

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Update denied')).toBeInTheDocument()
    })
  })

  it('displays email as read-only', async () => {
    render(<Profile />)

    await waitFor(() => {
      const emailInput = screen.getByDisplayValue('test@team.edu')
      expect(emailInput).toBeInTheDocument()
      expect(emailInput).toHaveAttribute('readOnly')
    })
  })

  it('email is not included in update payload', async () => {
    const user = userEvent.setup()
    render(<Profile />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Your name')).toHaveValue('Test Wrestler')
    })

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'Test Wrestler',
        weight_class: 152,
        show_on_board: false,
      })
    })
    // Verify email is NOT in the update payload
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('email')
  })

  it('handles null weight_class — input renders empty, saves null', async () => {
    mockSelect._result = {
      data: { email: 'test@team.edu', name: 'Test Wrestler', weight_class: null, show_on_board: false },
      error: null,
    }

    const user = userEvent.setup()
    render(<Profile />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('152')).toHaveValue(null)
    })

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'Test Wrestler',
        weight_class: null,
        show_on_board: false,
      })
    })
  })

  it('auth — returns early if no session on load', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
    })

    render(<Profile />)

    // Should stop loading but not crash, and not show an error
    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).not.toBeInTheDocument()
    })
  })
})
