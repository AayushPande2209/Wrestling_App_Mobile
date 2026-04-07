import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfWeek, endOfWeek, startOfDay, format } from 'date-fns'
import { supabase } from '../lib/supabase'

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a] min-h-[44px]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#aaa] mb-2'

const GOAL_TYPES = [
  { value: 'lifting', label: 'Lifting (auto)' },
  { value: 'practice', label: 'Practice Attendance (auto)' },
  { value: 'habit', label: 'Daily Habit (auto)' },
  { value: 'tournament_placement', label: 'Tournament Placement (manual)' },
  { value: 'other', label: 'Other (manual)' },
]

const AUTO_TYPES = new Set(['lifting', 'practice', 'habit'])

function getWeekBounds() {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })     // Sunday
  return { weekStart, weekEnd }
}

function getTrackingType(goalType) {
  return AUTO_TYPES.has(goalType) ? 'auto' : 'manual'
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="w-full h-1 bg-[#1a1a1a] mt-2">
      <div
        className="h-full transition-all duration-300"
        style={{
          width: `${pct}%`,
          background: pct >= 100 ? '#22c55e' : '#d97706',
        }}
      />
    </div>
  )
}

// Habit log button — self-contained component to avoid prop drilling
function HabitLogButton({ goal, uid, weekHabitLogs, queryClient }) {
  const [logging, setLogging] = useState(false)

  const todayStart = startOfDay(new Date()).toISOString()
  const alreadyLoggedToday = (weekHabitLogs[goal.id] ?? []).some(
    log => log.logged_at >= todayStart
  )

  async function handleLog() {
    setLogging(true)
    try {
      const { error } = await supabase.from('habit_logs').insert({
        goal_id: goal.id,
        wrestler_id: uid,
      })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['habit-logs-week', uid] })
    } catch (err) {
      alert(err.message)
    } finally {
      setLogging(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLog}
      disabled={alreadyLoggedToday || logging}
      className="font-mono text-[10px] tracking-[0.1em] px-3 py-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-[#d97706] text-[#d97706] hover:bg-[#d97706]/10"
    >
      {logging ? 'LOGGING...' : alreadyLoggedToday ? 'LOGGED TODAY' : 'LOG TODAY'}
    </button>
  )
}

// Single goal card — handles auto-complete side effect
function GoalCard({ goal, computedProgress, uid, weekHabitLogs, onDelete, queryClient }) {
  const isAuto = AUTO_TYPES.has(goal.goal_type)
  const progress = isAuto ? computedProgress : goal.progress
  const [markingComplete, setMarkingComplete] = useState(false)

  // Auto-complete: one-way latch — write completed=true once, never revert
  useEffect(() => {
    if (!goal.completed && progress >= 100) {
      supabase
        .from('goals')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', goal.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['goals', uid] })
        })
    }
    // Only fire when progress changes, not on every render; completed guards the write
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  async function handleMarkComplete() {
    setMarkingComplete(true)
    try {
      const { error } = await supabase
        .from('goals')
        .update({ completed: true, completed_at: new Date().toISOString(), progress: 100 })
        .eq('id', goal.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['goals', uid] })
    } catch (err) {
      alert(err.message)
    } finally {
      setMarkingComplete(false)
    }
  }

  const { weekStart, weekEnd } = getWeekBounds()
  const habitLogsThisWeek = (weekHabitLogs[goal.id] ?? []).length
  const targetLabel = goal.target != null
    ? `${goal.goal_type === 'habit' ? habitLogsThisWeek : Math.round(progress / 100 * (goal.target ?? 1))}/${goal.target} this week`
    : null

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-display text-[9px] tracking-[0.15em] text-[#888] mb-1">
            {goal.goal_type.replace('_', ' ').toUpperCase()}
          </div>
          <div className="font-mono text-sm text-[#f0f0f0] leading-snug">{goal.description}</div>
          {goal.target_date && (
            <div className="font-mono text-[10px] text-[#888] mt-1">
              By {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
          {targetLabel && (
            <div className="font-mono text-[10px] text-[#aaa] mt-0.5">{targetLabel}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="font-mono text-[10px] text-[#333] hover:text-red-500 tracking-[0.1em] transition-colors shrink-0"
        >
          DELETE
        </button>
      </div>

      <ProgressBar value={progress} />
      <div className="font-mono text-[10px] text-[#aaa] mt-1.5">{Math.round(progress)}%</div>

      <div className="mt-3 flex gap-3 flex-wrap">
        {goal.goal_type === 'habit' && !goal.completed && (
          <HabitLogButton
            goal={goal}
            uid={uid}
            weekHabitLogs={weekHabitLogs}
            queryClient={queryClient}
          />
        )}
        {!isAuto && !goal.completed && (
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={markingComplete}
            className="font-mono text-[10px] tracking-[0.1em] px-3 py-1.5 border border-[#555] text-[#888] hover:border-[#d97706] hover:text-[#d97706] transition-colors disabled:opacity-40"
          >
            {markingComplete ? 'SAVING...' : 'MARK COMPLETE'}
          </button>
        )}
        {goal.completed && (
          <span className="font-display text-[9px] tracking-[0.15em] text-green-500 border border-green-800/50 bg-green-950/20 px-2 py-1">
            COMPLETED
          </span>
        )}
      </div>
    </div>
  )
}

export default function Goals() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)

  // Form state
  const [goalType, setGoalType] = useState('lifting')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  // Load all goals
  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['goals', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('id, goal_type, tracking_type, description, target, progress, target_date, tournament_id, completed, completed_at, created_at')
        .eq('wrestler_id', uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  // Load wrestler's tournaments for dropdown
  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, date')
        .eq('wrestler_id', uid)
        .order('date', { ascending: false, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 60_000,
  })

  // Week bounds for all "this week" queries — computed once per render
  const { weekStart, weekEnd } = getWeekBounds()
  const weekStartISO = weekStart.toISOString()
  const weekEndISO = weekEnd.toISOString()
  const weekStartDate = format(weekStart, 'yyyy-MM-dd')
  const weekEndDate = format(weekEnd, 'yyyy-MM-dd')

  // Lifting progress: count workouts this week
  const { data: weekWorkouts = [] } = useQuery({
    queryKey: ['workouts-week', uid, weekStartDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('id')
        .eq('wrestler_id', uid)
        .gte('workout_date', weekStartDate)
        .lte('workout_date', weekEndDate)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  // Practice progress: count practice schedule events this week
  const { data: weekPractices = [] } = useQuery({
    queryKey: ['practices-week', uid, weekStartISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id')
        .eq('wrestler_id', uid)
        .eq('event_type', 'practice')
        .gte('starts_at', weekStartISO)
        .lte('starts_at', weekEndISO)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  // Habit logs this week for all habit goals — keyed by goal_id
  const { data: habitLogsRaw = [] } = useQuery({
    queryKey: ['habit-logs-week', uid, weekStartISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id, goal_id, logged_at')
        .eq('wrestler_id', uid)
        .gte('logged_at', weekStartISO)
        .lte('logged_at', weekEndISO)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 10_000,
  })

  // Group habit logs by goal_id
  const weekHabitLogs = habitLogsRaw.reduce((acc, log) => {
    if (!acc[log.goal_id]) acc[log.goal_id] = []
    acc[log.goal_id].push(log)
    return acc
  }, {})

  // Compute progress for each auto goal
  function computeProgress(goal) {
    if (!goal.target || goal.target <= 0) return 0
    let count = 0
    if (goal.goal_type === 'lifting') count = weekWorkouts.length
    else if (goal.goal_type === 'practice') count = weekPractices.length
    else if (goal.goal_type === 'habit') count = (weekHabitLogs[goal.id] ?? []).length
    return Math.min(100, Math.round((count / goal.target) * 100))
  }

  const today = new Date().toISOString().split('T')[0]
  const activeGoals = goals.filter(g => !g.completed && (!g.target_date || g.target_date >= today))
  const pastGoals = goals.filter(g => g.completed || (g.target_date && g.target_date < today))

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)
    setSubmitting(true)
    try {
      const trackingType = getTrackingType(goalType)
      const insert = {
        wrestler_id: uid,
        goal_type: goalType,
        tracking_type: trackingType,
        description: description.trim(),
        target: AUTO_TYPES.has(goalType) && target !== '' ? parseInt(target) : null,
        target_date: targetDate || null,
        tournament_id: goalType === 'tournament_placement' && tournamentId ? tournamentId : null,
      }
      const { error } = await supabase.from('goals').insert(insert)
      if (error) throw error
      setDescription('')
      setTarget('')
      setTargetDate('')
      setTournamentId('')
      setSubmitSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['goals', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('goals').delete().eq('id', pendingDelete)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['goals', uid] })
      queryClient.invalidateQueries({ queryKey: ['habit-logs-week', uid] })
      setPendingDelete(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const isAuto = AUTO_TYPES.has(goalType)

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">GOALS</h1>
        <p className="font-mono text-[11px] text-[#888] tracking-[0.1em] mt-1">
          Track season targets. Auto goals compute progress from your activity this week.
        </p>
      </div>

      {/* New goal form */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">ADD GOAL</div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>GOAL TYPE</label>
              <select
                value={goalType}
                onChange={e => { setGoalType(e.target.value); setTarget('') }}
                className={inputClass}
              >
                {GOAL_TYPES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>TARGET DATE (OPTIONAL)</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>DESCRIPTION</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              placeholder={
                goalType === 'lifting' ? 'e.g. Lift 3x per week'
                : goalType === 'practice' ? 'e.g. Attend all practices'
                : goalType === 'habit' ? 'e.g. Morning run'
                : goalType === 'tournament_placement' ? 'e.g. Place top 3 at States'
                : 'Describe your goal'
              }
              className={inputClass}
            />
          </div>

          {isAuto && (
            <div>
              <label className={labelClass}>
                WEEKLY TARGET{' '}
                <span className="text-[#333]">
                  ({goalType === 'lifting' ? 'workouts/week'
                    : goalType === 'practice' ? 'practices/week'
                    : 'logs/week'})
                </span>
              </label>
              <input
                type="number"
                value={target}
                onChange={e => setTarget(e.target.value)}
                required
                min="1"
                max="14"
                inputMode="numeric"
                placeholder="e.g. 3"
                className={inputClass}
              />
            </div>
          )}

          {goalType === 'tournament_placement' && (
            <div>
              <label className={labelClass}>TOURNAMENT (OPTIONAL)</label>
              <select
                value={tournamentId}
                onChange={e => setTournamentId(e.target.value)}
                className={inputClass}
              >
                <option value="">— None —</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.date ? ` (${new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {submitError && (
            <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className="text-[11px] font-mono text-green-500 border border-green-900/50 bg-green-950/20 px-3 py-2">
              Goal added.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full md:w-auto bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] px-6 py-2.5 hover:bg-[#b45309] transition-colors disabled:opacity-40 min-h-[44px]"
          >
            {submitting ? 'SAVING...' : 'ADD GOAL'}
          </button>
        </form>
      </div>

      {/* Active goals */}
      <div>
        <div className="text-[10px] font-display tracking-[0.15em] text-[#aaa] mb-4">
          ACTIVE GOALS
          {activeGoals.length > 0 && (
            <span className="ml-2 text-[#333]">
              — Week of {format(weekStart, 'MMM d')}–{format(weekEnd, 'MMM d')}
            </span>
          )}
        </div>

        {goalsLoading && <p className="font-mono text-[11px] text-[#888]">Loading...</p>}
        {!goalsLoading && activeGoals.length === 0 && (
          <p className="font-mono text-[11px] text-[#333] tracking-[0.1em]">No active goals. Add one above.</p>
        )}

        <div className="space-y-3">
          {activeGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              computedProgress={computeProgress(goal)}
              uid={uid}
              weekHabitLogs={weekHabitLogs}
              onDelete={() => setPendingDelete(goal.id)}
              queryClient={queryClient}
            />
          ))}
        </div>
      </div>

      {/* Past goals */}
      {pastGoals.length > 0 && (
        <div>
          <div className="text-[10px] font-display tracking-[0.15em] text-[#aaa] mb-4">PAST GOALS</div>
          <div className="space-y-2">
            {pastGoals.map(goal => {
              const succeeded = goal.completed
              return (
                <div key={goal.id} className="border border-[#1a1a1a] bg-[#060606] p-4 flex items-start gap-4 opacity-70">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[9px] tracking-[0.15em] text-[#333] mb-0.5">
                      {goal.goal_type.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="font-mono text-sm text-[#888] leading-snug">{goal.description}</div>
                    {goal.target_date && (
                      <div className="font-mono text-[10px] text-[#333] mt-1">
                        {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {succeeded ? (
                      <span className="font-display text-[9px] tracking-[0.15em] text-green-500 border border-green-800/50 bg-green-950/20 px-2 py-1">
                        COMPLETED
                      </span>
                    ) : (
                      <span className="font-display text-[9px] tracking-[0.15em] text-[#aaa] border border-[#222] px-2 py-1">
                        MISSED
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingDelete(goal.id)}
                      className="font-mono text-[10px] text-[#333] hover:text-red-500 tracking-[0.1em] transition-colors"
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-7 max-w-sm w-full">
            <div className="font-display text-[10px] tracking-[0.15em] text-[#d97706] mb-4">
              DELETE GOAL
            </div>
            <p className="font-mono text-xs text-[#888] mb-6">
              This will permanently delete the goal and any associated habit logs.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-red-700 text-white font-display font-bold text-[10px] tracking-[0.2em] px-5 py-2.5 hover:bg-red-600 transition-colors disabled:opacity-40"
              >
                {deleting ? 'DELETING...' : 'DELETE'}
              </button>
              <button
                onClick={() => setPendingDelete(null)}
                className="font-mono text-[10px] text-[#888] hover:text-[#ccc] tracking-[0.1em] transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
