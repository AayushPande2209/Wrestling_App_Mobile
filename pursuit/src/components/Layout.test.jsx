import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Layout from './Layout'

// ---------- Supabase mock ----------
const mockSignOut = vi.fn().mockResolvedValue({})

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: (...args) => mockSignOut(...args),
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Mock window.location.href setter
  delete window.location
  window.location = { href: '' }
})

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Layout>
        <div>PAGE CONTENT</div>
      </Layout>
    </MemoryRouter>
  )
}

// ---------- Tests ----------
describe('Layout', () => {
  it('renders without crashing — shows sidebar and children', () => {
    renderLayout()
    expect(screen.getByText('PURSUIT')).toBeInTheDocument()
    expect(screen.getByText('PAGE CONTENT')).toBeInTheDocument()
  })

  it('shows all nav links from spec', () => {
    renderLayout()
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    expect(screen.getByText('WEIGHT')).toBeInTheDocument()
    expect(screen.getByText('MATCHES')).toBeInTheDocument()
    expect(screen.getByText('NOTES')).toBeInTheDocument()
    expect(screen.getByText('SCHEDULE')).toBeInTheDocument()
    expect(screen.getByText('WORKOUTS')).toBeInTheDocument()
    expect(screen.getByText('GOALS')).toBeInTheDocument()
    expect(screen.getByText('NUTRITION')).toBeInTheDocument()
    expect(screen.getByText('RECORDS')).toBeInTheDocument()
    expect(screen.getByText('TIMELINE')).toBeInTheDocument()
    expect(screen.getByText('BOARD')).toBeInTheDocument()
    expect(screen.getByText('PROFILE')).toBeInTheDocument()
  })

  it('nav links point to correct routes', () => {
    renderLayout()
    const links = [
      { label: 'DASHBOARD', href: '/dashboard' },
      { label: 'WEIGHT', href: '/weight' },
      { label: 'MATCHES', href: '/matches' },
      { label: 'NOTES', href: '/notes' },
      { label: 'SCHEDULE', href: '/schedule' },
      { label: 'WORKOUTS', href: '/workouts' },
      { label: 'GOALS', href: '/goals' },
      { label: 'NUTRITION', href: '/nutrition' },
      { label: 'RECORDS', href: '/records' },
      { label: 'TIMELINE', href: '/timeline' },
      { label: 'BOARD', href: '/board' },
      { label: 'PROFILE', href: '/profile' },
    ]
    links.forEach(({ label, href }) => {
      const link = screen.getByText(label).closest('a')
      expect(link).toHaveAttribute('href', href)
    })
  })

  it('sign out button calls supabase signOut and redirects', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByText('SIGN OUT'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(window.location.href).toBe('/auth')
    })
  })
})
