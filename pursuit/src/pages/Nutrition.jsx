import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a] min-h-[44px]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2'

const MEAL_TYPE_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', other: 'Meal' }

function MacroRow({ label, value, unit = 'g', color = '#888' }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-mono text-[10px] tracking-[0.1em] text-[#555]">{label}</span>
      <span className="font-mono text-sm" style={{ color }}>
        {value}<span className="text-[#444] text-[10px] ml-0.5">{unit}</span>
      </span>
    </div>
  )
}

function MealCard({ meal }) {
  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
      <div className="font-display text-[9px] tracking-[0.2em] text-[#d97706] mb-1">
        {MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type.toUpperCase()}
      </div>
      <div className="font-mono text-sm text-[#f0f0f0] mb-3 leading-snug capitalize">{meal.name}</div>
      <div className="space-y-1.5">
        <MacroRow label="CALORIES" value={meal.calories} unit="kcal" color="#f0f0f0" />
        <MacroRow label="PROTEIN" value={`${meal.protein}`} color="#d97706" />
        <MacroRow label="CARBS" value={`${meal.carbs}`} color="#888" />
        <MacroRow label="FAT" value={`${meal.fat}`} color="#555" />
        {meal.sodium != null && (
          <MacroRow label="SODIUM" value={meal.sodium} unit="mg" color="#3b82f6" />
        )}
      </div>
    </div>
  )
}

async function fetchWithAuth(url, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No session')
  const { _ts, ...payload } = body
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export default function Nutrition() {
  // Meal plan form inputs
  const [mpWeight, setMpWeight] = useState('')
  const [mpClass, setMpClass] = useState('')
  const [mpDays, setMpDays] = useState('')
  const [mpSubmitted, setMpSubmitted] = useState(false)
  const [mpInputs, setMpInputs] = useState(null)

  // Recovery form inputs
  const [rcBefore, setRcBefore] = useState('')
  const [rcAfter, setRcAfter] = useState('')
  const [rcHours, setRcHours] = useState('')
  const [rcSubmitted, setRcSubmitted] = useState(false)
  const [rcInputs, setRcInputs] = useState(null)

  // Meal plan query — enabled only after form submit
  const {
    data: mealPlan,
    isFetching: mpFetching,
    isError: mpError,
  } = useQuery({
    queryKey: ['meal-plan', mpInputs],
    queryFn: () => fetchWithAuth(`${API_URL}/predict/meal-plan`, mpInputs),
    enabled: !!mpInputs,
    staleTime: 300_000,
    retry: false,
  })

  // Recovery query — enabled only after form submit
  const {
    data: recovery,
    isFetching: rcFetching,
    isError: rcError,
  } = useQuery({
    queryKey: ['recovery', rcInputs],
    queryFn: () => fetchWithAuth(`${API_URL}/predict/recovery-protocol`, rcInputs),
    enabled: !!rcInputs,
    staleTime: 300_000,
    retry: false,
  })

  function handleMpSubmit(e) {
    e.preventDefault()
    setMpInputs({
      current_weight: parseFloat(mpWeight),
      target_weight_class: parseInt(mpClass),
      days_until_weigh_in: parseInt(mpDays),
      _ts: Date.now(),
    })
    setMpSubmitted(true)
  }

  function handleRcSubmit(e) {
    e.preventDefault()
    setRcInputs({
      weight_before_cut: parseFloat(rcBefore),
      weight_after_cut: parseFloat(rcAfter),
      hours_until_match: parseInt(rcHours),
      _ts: Date.now(),
    })
    setRcSubmitted(true)
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">NUTRITION</h1>
        <p className="font-mono text-[11px] text-[#444] tracking-[0.1em] mt-1">
          Meal planning and post-weigh-in recovery protocols
        </p>
      </div>

      {/* ── Section 1: Cut Meal Planner ── */}
      <section className="space-y-6">
        <div className="text-[10px] font-display tracking-[0.2em] text-[#555] border-b border-[#1a1a1a] pb-3">
          CUT MEAL PLANNER
        </div>

        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
          <form onSubmit={handleMpSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>CURRENT WEIGHT (LBS)</label>
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="400"
                  inputMode="decimal"
                  value={mpWeight}
                  onChange={e => setMpWeight(e.target.value)}
                  required
                  placeholder="158.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>TARGET CLASS (LBS)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mpClass}
                  onChange={e => setMpClass(e.target.value)}
                  required
                  placeholder="152"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>DAYS UNTIL WEIGH-IN</label>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={mpDays}
                  onChange={e => setMpDays(e.target.value)}
                  required
                  placeholder="7"
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={mpFetching}
              className="w-full md:w-auto bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] px-6 py-2.5 hover:bg-[#b45309] transition-colors disabled:opacity-40 min-h-[44px]"
            >
              {mpFetching ? 'LOADING...' : 'GET MEAL PLAN'}
            </button>
          </form>
        </div>

        {mpSubmitted && !mpFetching && mpError && (
          <p className="font-mono text-[11px] text-[#444] tracking-[0.1em]">
            Meal suggestions unavailable right now.
          </p>
        )}

        {mealPlan && (
          <div className="space-y-4">
            {/* Daily totals */}
            <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-5">
              <div className="font-display text-[9px] tracking-[0.2em] text-[#555] mb-4">DAILY TARGETS</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
                {[
                  { label: 'CALORIES', value: mealPlan.daily_calories, unit: 'kcal', color: '#f0f0f0' },
                  { label: 'PROTEIN', value: mealPlan.daily_macros.protein, unit: 'g', color: '#d97706' },
                  { label: 'CARBS', value: mealPlan.daily_macros.carbs, unit: 'g', color: '#888' },
                  { label: 'FAT', value: mealPlan.daily_macros.fat, unit: 'g', color: '#555' },
                  { label: 'SODIUM', value: mealPlan.daily_macros.sodium, unit: 'mg', color: mealPlan.sodium_warning ? '#f59e0b' : '#3b82f6' },
                ].map(({ label, value, unit, color }) => (
                  <div key={label}>
                    <div className="font-display text-[9px] tracking-[0.15em] text-[#444] mb-1">{label}</div>
                    <div className="font-mono text-2xl font-bold" style={{ color }}>
                      {value}
                      <span className="font-mono text-[10px] text-[#444] ml-1">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Sodium warning */}
            {mealPlan.sodium_warning && (
              <div className="flex items-start gap-3 border border-amber-800/50 bg-amber-950/20 px-4 py-3">
                <span className="font-mono text-amber-500 text-sm shrink-0">⚠</span>
                <p className="font-mono text-[11px] text-amber-400 leading-relaxed">
                  These meals are higher in sodium than ideal for cutting — consider lower-sodium alternatives.
                  Target is under {mealPlan.sodium_target}mg/day to minimize water retention.
                </p>
              </div>
            )}
            {/* Meal cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mealPlan.meals.map((meal, i) => (
                <MealCard key={i} meal={meal} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Section 2: Recovery Protocol ── */}
      <section className="space-y-6">
        <div className="text-[10px] font-display tracking-[0.2em] text-[#555] border-b border-[#1a1a1a] pb-3">
          POST WEIGH-IN RECOVERY
        </div>

        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
          <form onSubmit={handleRcSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>WEIGHT BEFORE CUT (LBS)</label>
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="400"
                  inputMode="decimal"
                  value={rcBefore}
                  onChange={e => setRcBefore(e.target.value)}
                  required
                  placeholder="158.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>WEIGHT AFTER WEIGH-IN (LBS)</label>
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="400"
                  inputMode="decimal"
                  value={rcAfter}
                  onChange={e => setRcAfter(e.target.value)}
                  required
                  placeholder="152.0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>HOURS UNTIL FIRST MATCH</label>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={rcHours}
                  onChange={e => setRcHours(e.target.value)}
                  required
                  placeholder="4"
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={rcFetching}
              className="w-full md:w-auto bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] px-6 py-2.5 hover:bg-[#b45309] transition-colors disabled:opacity-40 min-h-[44px]"
            >
              {rcFetching ? 'LOADING...' : 'GET RECOVERY PLAN'}
            </button>
          </form>
        </div>

        {rcSubmitted && !rcFetching && rcError && (
          <p className="font-mono text-[11px] text-[#444] tracking-[0.1em]">
            Meal suggestions unavailable right now.
          </p>
        )}

        {recovery && (
          <div className="space-y-6">
            {/* Fluids target */}
            <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-5 flex items-center gap-6">
              <div>
                <div className="font-display text-[9px] tracking-[0.2em] text-[#555] mb-1">FLUIDS TARGET</div>
                <div className="font-mono text-3xl font-bold text-[#d97706]">
                  {recovery.fluids_oz}
                  <span className="font-mono text-[11px] text-[#555] ml-1">oz</span>
                </div>
              </div>
              <div className="font-mono text-[11px] text-[#444] leading-relaxed border-l border-[#1a1a1a] pl-6">
                Rehydrate before eating. Spread intake over{' '}
                {recovery.timeline.length > 1 ? 'the full window' : 'available time'} — do not drink all at once.
              </div>
            </div>

            {/* Timeline */}
            <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-5">
              <div className="font-display text-[9px] tracking-[0.2em] text-[#555] mb-5">TIMELINE</div>
              <div className="space-y-0">
                {recovery.timeline.map((step, i) => {
                  const h = step.hours_before_match
                  const timeLabel = h === 0.5 ? '30 min' : `${h}h`
                  return (
                    <div key={i} className="flex gap-4">
                      {/* Time column */}
                      <div className="flex flex-col items-center w-16 shrink-0">
                        <div className="font-mono text-[10px] text-[#d97706] tracking-[0.05em] whitespace-nowrap">
                          T − {timeLabel}
                        </div>
                        {i < recovery.timeline.length - 1 && (
                          <div className="w-px flex-1 bg-[#1e1e1e] my-1.5" />
                        )}
                      </div>
                      {/* Action */}
                      <div className={`font-mono text-xs text-[#ccc] leading-snug ${i < recovery.timeline.length - 1 ? 'pb-5' : ''}`}>
                        {step.action}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sodium tip */}
            {recovery.sodium_target_mg && (
              <div className="flex items-start gap-3 border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
                <span className="font-mono text-[#3b82f6] text-sm shrink-0">ⓘ</span>
                <p className="font-mono text-[11px] text-[#555] leading-relaxed">
                  Sodium target: aim for {recovery.sodium_target_mg}–2000mg during recovery.
                  Sodium helps your body retain the fluids you're drinking — choose electrolyte drinks and lightly salted foods.
                </p>
              </div>
            )}

            {/* Recovery meals */}
            <div>
              <div className="font-display text-[9px] tracking-[0.2em] text-[#555] mb-4">RECOVERY MEALS</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recovery.meals.map((meal, i) => (
                  <MealCard key={i} meal={meal} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
