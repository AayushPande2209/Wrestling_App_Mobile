import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Nutrition from './Nutrition'

// ---------- Mock data ----------
const MEAL_PLAN = {
  daily_calories: 1800,
  daily_macros: { protein: 155, carbs: 180, fat: 50, sodium: 1200 },
  sodium_target: 1500,
  sodium_warning: false,
  meals: [
    { meal_type: 'breakfast', name: 'Oatmeal', calories: 400, protein: 25, carbs: 45, fat: 10, sodium: 300 },
    { meal_type: 'lunch', name: 'Grilled Chicken Breast', calories: 500, protein: 40, carbs: 50, fat: 8, sodium: 500 },
    { meal_type: 'dinner', name: 'Baked Salmon Fillet', calories: 450, protein: 35, carbs: 40, fat: 12, sodium: 400 },
  ],
}

const RECOVERY = {
  fluids_oz: 96,
  sodium_target_mg: 1500,
  meals: [
    { meal_type: 'breakfast', name: 'Oatmeal', calories: 200, protein: 10, carbs: 30, fat: 3, sodium: 100 },
    { meal_type: 'lunch', name: 'Chicken', calories: 200, protein: 10, carbs: 30, fat: 3, sodium: 200 },
    { meal_type: 'dinner', name: 'Salmon', calories: 200, protein: 10, carbs: 30, fat: 2, sodium: 100 },
  ],
  timeline: [
    { hours_before_match: 4, action: 'Drink 16oz water with electrolytes immediately' },
    { hours_before_match: 2, action: 'Eat recovery meal' },
    { hours_before_match: 0.5, action: 'Light snack' },
  ],
}

// ---------- Supabase mock ----------
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { user: { id: 'uid-1' }, access_token: 'test-jwt' },
        },
      }),
    },
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

// ---------- Fetch mock ----------
const originalFetch = globalThis.fetch
beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('/predict/meal-plan')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MEAL_PLAN),
      })
    }
    if (url.includes('/predict/recovery-protocol')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(RECOVERY),
      })
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
  })
})
afterAll(() => {
  globalThis.fetch = originalFetch
})

// ---------- Tests ----------
describe('Nutrition', () => {
  it('renders without crashing — shows both sections', async () => {
    renderWithClient(<Nutrition />)
    await waitFor(() => {
      expect(screen.getByText('NUTRITION')).toBeInTheDocument()
    })
    expect(screen.getByText('CUT MEAL PLANNER')).toBeInTheDocument()
    expect(screen.getByText('POST WEIGH-IN RECOVERY')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get meal plan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get recovery plan/i })).toBeInTheDocument()
  })

  it('happy path — meal plan returns results with macro cards', async () => {
    const user = userEvent.setup()
    renderWithClient(<Nutrition />)

    await waitFor(() => {
      expect(screen.getByText('CUT MEAL PLANNER')).toBeInTheDocument()
    })

    // Both sections have weight inputs with placeholder "158.5" — use first (meal plan section)
    await user.type(screen.getAllByPlaceholderText('158.5')[0], '158')
    await user.type(screen.getAllByPlaceholderText('152')[0], '152')
    await user.type(screen.getByPlaceholderText('7'), '7')
    await user.click(screen.getByRole('button', { name: /get meal plan/i }))

    await waitFor(() => {
      expect(screen.getByText('DAILY TARGETS')).toBeInTheDocument()
      expect(screen.getByText('1800')).toBeInTheDocument()
    })
    // Meal cards
    expect(screen.getByText('Oatmeal')).toBeInTheDocument()
    expect(screen.getByText('Grilled Chicken Breast')).toBeInTheDocument()
    expect(screen.getByText('Baked Salmon Fillet')).toBeInTheDocument()
  })

  it('happy path — recovery protocol returns fluids target and timeline', async () => {
    const user = userEvent.setup()
    renderWithClient(<Nutrition />)

    await waitFor(() => {
      expect(screen.getByText('POST WEIGH-IN RECOVERY')).toBeInTheDocument()
    })

    // Recovery form — use the second set of placeholders
    const weightInputs = screen.getAllByPlaceholderText('158.5')
    await user.type(weightInputs[1], '158')
    await user.type(screen.getByPlaceholderText('152.0'), '152')
    await user.type(screen.getByPlaceholderText('4'), '4')
    await user.click(screen.getByRole('button', { name: /get recovery plan/i }))

    await waitFor(() => {
      expect(screen.getByText('FLUIDS TARGET')).toBeInTheDocument()
      expect(screen.getByText('96')).toBeInTheDocument()
    })
    expect(screen.getByText('TIMELINE')).toBeInTheDocument()
    expect(screen.getByText(/Drink 16oz water/)).toBeInTheDocument()
    expect(screen.getByText('RECOVERY MEALS')).toBeInTheDocument()
  })

  it('silent failure — meal plan shows inline message when API down', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
    )
    const user = userEvent.setup()
    renderWithClient(<Nutrition />)

    await waitFor(() => {
      expect(screen.getByText('CUT MEAL PLANNER')).toBeInTheDocument()
    })

    await user.type(screen.getAllByPlaceholderText('158.5')[0], '158')
    await user.type(screen.getAllByPlaceholderText('152')[0], '152')
    await user.type(screen.getByPlaceholderText('7'), '7')
    await user.click(screen.getByRole('button', { name: /get meal plan/i }))

    await waitFor(() => {
      expect(screen.getByText('Meal suggestions unavailable right now.')).toBeInTheDocument()
    })
  })

  it('silent failure — recovery shows inline message when API down', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
    )
    const user = userEvent.setup()
    renderWithClient(<Nutrition />)

    await waitFor(() => {
      expect(screen.getByText('POST WEIGH-IN RECOVERY')).toBeInTheDocument()
    })

    const weightInputs = screen.getAllByPlaceholderText('158.5')
    await user.type(weightInputs[1], '158')
    await user.type(screen.getByPlaceholderText('152.0'), '152')
    await user.type(screen.getByPlaceholderText('4'), '4')
    await user.click(screen.getByRole('button', { name: /get recovery plan/i }))

    await waitFor(() => {
      const msgs = screen.getAllByText('Meal suggestions unavailable right now.')
      expect(msgs.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('auth — sends JWT in Authorization header', async () => {
    const user = userEvent.setup()
    renderWithClient(<Nutrition />)

    await waitFor(() => {
      expect(screen.getByText('CUT MEAL PLANNER')).toBeInTheDocument()
    })

    await user.type(screen.getAllByPlaceholderText('158.5')[0], '158')
    await user.type(screen.getAllByPlaceholderText('152')[0], '152')
    await user.type(screen.getByPlaceholderText('7'), '7')
    await user.click(screen.getByRole('button', { name: /get meal plan/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/predict/meal-plan'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt',
          }),
        })
      )
    })
  })

  it('meal plan form has correct input constraints', () => {
    renderWithClient(<Nutrition />)
    const weightInput = screen.getAllByPlaceholderText('158.5')[0]
    expect(weightInput).toHaveAttribute('min', '50')
    expect(weightInput).toHaveAttribute('max', '400')
    expect(weightInput).toHaveAttribute('step', '0.1')
    expect(screen.getByPlaceholderText('7')).toHaveAttribute('min', '1')
  })
})
