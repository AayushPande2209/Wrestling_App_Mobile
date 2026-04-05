import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 15

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2'

const EMPTY_ROW = { name: '', sets: '', reps: '', weight: '' }

const WORKOUT_TYPES = [
  { value: 'lifting',  label: 'Lifting' },
  { value: 'practice', label: 'Wrestling Practice' },
  { value: 'cardio',   label: 'Cardio' },
  { value: 'other',    label: 'Other' },
]

const TYPE_LABELS = Object.fromEntries(WORKOUT_TYPES.map(t => [t.value, t.label]))

// Fetch exercises for a single lifting workout on demand
function WorkoutExercises({ workoutId, uid }) {
  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['workout_exercises', workoutId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_exercises')
        .select('id, name, sets, reps, weight')
        .eq('workout_id', workoutId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid && !!workoutId,
    staleTime: 60_000,
  })

  if (isLoading) {
    return <p className="font-mono text-[10px] text-[#444] tracking-[0.1em] px-4 pb-3">Loading...</p>
  }
  if (!exercises.length) {
    return <p className="font-mono text-[10px] text-[#444] tracking-[0.1em] px-4 pb-3">No exercises logged.</p>
  }

  return (
    <div className="px-4 pb-4">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            {['EXERCISE', 'SETS', 'REPS', 'WEIGHT'].map(h => (
              <th key={h} className="font-display text-[9px] tracking-[0.15em] text-[#444] pb-2 pr-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exercises.map(ex => (
            <tr key={ex.id} className="border-b border-[#111]">
              <td className="font-mono text-xs text-[#ccc] py-2 pr-4">{ex.name}</td>
              <td className="font-mono text-xs text-[#888] py-2 pr-4">{ex.sets ?? '—'}</td>
              <td className="font-mono text-xs text-[#888] py-2 pr-4">{ex.reps ?? '—'}</td>
              <td className="font-mono text-xs text-[#888] py-2">
                {ex.weight != null ? `${ex.weight} lbs` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Workouts() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [page, setPage] = useState(0)
  const [allWorkouts, setAllWorkouts] = useState([])
  const [expandedId, setExpandedId] = useState(null)

  // Form state
  const [editingId, setEditingId] = useState(null)
  const [workoutType, setWorkoutType] = useState('lifting')
  const [workoutDate, setWorkoutDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [durationMinutes, setDurationMinutes] = useState('')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [rows, setRows] = useState([{ ...EMPTY_ROW }])
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

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['workouts', uid, page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, workout_type, workout_date, duration_minutes, notes, created_at')
        .eq('wrestler_id', uid)
        .order('workout_date', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!pageData) return
    if (page === 0) setAllWorkouts(pageData)
    else setAllWorkouts(prev => [...prev, ...pageData])
  }, [pageData, page])

  function resetForm() {
    setEditingId(null)
    setWorkoutType('lifting')
    setWorkoutDate(format(new Date(), 'yyyy-MM-dd'))
    setDurationMinutes('')
    setWorkoutNotes('')
    setRows([{ ...EMPTY_ROW }])
    setSubmitError(null)
    setSubmitSuccess(false)
  }

  function startEdit(workout) {
    setEditingId(workout.id)
    setWorkoutType(workout.workout_type ?? 'lifting')
    setWorkoutDate(workout.workout_date)
    setDurationMinutes(workout.duration_minutes ?? '')
    setWorkoutNotes(workout.notes ?? '')
    setSubmitError(null)
    setSubmitSuccess(false)

    if ((workout.workout_type ?? 'lifting') === 'lifting') {
      const cached = queryClient.getQueryData(['workout_exercises', workout.id])
      if (cached?.length) {
        setRows(cached.map(ex => ({
          name: ex.name,
          sets: ex.sets ?? '',
          reps: ex.reps ?? '',
          weight: ex.weight ?? '',
        })))
      } else {
        setRows([{ ...EMPTY_ROW }])
        supabase
          .from('workout_exercises')
          .select('id, name, sets, reps, weight')
          .eq('workout_id', workout.id)
          .order('created_at', { ascending: true })
          .then(({ data }) => {
            if (data?.length) {
              setRows(data.map(ex => ({
                name: ex.name,
                sets: ex.sets ?? '',
                reps: ex.reps ?? '',
                weight: ex.weight ?? '',
              })))
            }
          })
      }
    } else {
      setRows([{ ...EMPTY_ROW }])
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateRow(idx, field, value) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)
    setSubmitting(true)

    try {
      if (editingId) {
        const { error: wErr } = await supabase
          .from('workouts')
          .update({
            workout_type: workoutType,
            workout_date: workoutDate,
            duration_minutes: durationMinutes !== '' ? parseInt(durationMinutes) : null,
            notes: workoutNotes || null,
          })
          .eq('id', editingId)
        if (wErr) throw wErr

        if (workoutType === 'lifting') {
          const validRows = rows.filter(r => r.name.trim())
          if (!validRows.length) {
            setSubmitError('Add at least one exercise with a name.')
            setSubmitting(false)
            return
          }
          const { error: dErr } = await supabase
            .from('workout_exercises')
            .delete()
            .eq('workout_id', editingId)
          if (dErr) throw dErr

          const { error: iErr } = await supabase.from('workout_exercises').insert(
            validRows.map(r => ({
              workout_id: editingId,
              wrestler_id: uid,
              name: r.name.trim(),
              sets: r.sets !== '' ? parseInt(r.sets) : null,
              reps: r.reps !== '' ? parseInt(r.reps) : null,
              weight: r.weight !== '' ? parseFloat(r.weight) : null,
            }))
          )
          if (iErr) throw iErr
          queryClient.invalidateQueries({ queryKey: ['workout_exercises', editingId] })
        }

        queryClient.invalidateQueries({ queryKey: ['workouts', uid] })
        queryClient.invalidateQueries({ queryKey: ['goals', uid] })
      } else {
        if (workoutType === 'lifting') {
          const validRows = rows.filter(r => r.name.trim())
          if (!validRows.length) {
            setSubmitError('Add at least one exercise with a name.')
            setSubmitting(false)
            return
          }
          const { error: rpcErr } = await supabase.rpc('insert_lifting_workout', {
            p_workout_date: workoutDate,
            p_notes: workoutNotes || null,
            p_exercises: validRows.map(r => ({
              name: r.name.trim(),
              sets: r.sets !== '' ? parseInt(r.sets) : null,
              reps: r.reps !== '' ? parseInt(r.reps) : null,
              weight: r.weight !== '' ? parseFloat(r.weight) : null,
            })),
          })
          if (rpcErr) throw rpcErr
        } else {
          const { error } = await supabase.from('workouts').insert({
            wrestler_id: uid,
            workout_type: workoutType,
            workout_date: workoutDate,
            duration_minutes: durationMinutes !== '' ? parseInt(durationMinutes) : null,
            notes: workoutNotes || null,
          })
          if (error) throw error
        }

        setPage(0)
        queryClient.invalidateQueries({ queryKey: ['workouts', uid] })
        queryClient.invalidateQueries({ queryKey: ['goals', uid] })
      }

      setSubmitSuccess(true)
      resetForm()
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
      const { error } = await supabase.from('workouts').delete().eq('id', pendingDelete)
      if (error) throw error
      setAllWorkouts(prev => prev.filter(w => w.id !== pendingDelete))
      queryClient.invalidateQueries({ queryKey: ['workouts', uid] })
      queryClient.invalidateQueries({ queryKey: ['goals', uid] })
      setPendingDelete(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const hasMore = pageData?.length === PAGE_SIZE

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">WORKOUTS</h1>
        <p className="font-mono text-[11px] text-[#444] tracking-[0.1em] mt-1">Log lifting, practice, cardio, and more</p>
      </div>

      {/* Form */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">
          {editingId ? 'EDIT WORKOUT' : 'LOG WORKOUT'}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type selector */}
          <div className="flex gap-2 flex-wrap">
            {WORKOUT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setWorkoutType(t.value); setRows([{ ...EMPTY_ROW }]) }}
                className={`px-4 py-2 font-display text-[10px] tracking-[0.15em] border transition-colors ${
                  workoutType === t.value
                    ? 'border-[#d97706] text-[#d97706] bg-[#d97706]/10'
                    : 'border-[#1e1e1e] text-[#444] hover:border-[#555] hover:text-[#888]'
                }`}
              >
                {t.label.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>DATE</label>
              <input
                type="date"
                value={workoutDate}
                onChange={e => setWorkoutDate(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>DURATION (MIN, OPTIONAL)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                min="1"
                max="480"
                placeholder="60"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>NOTES (OPTIONAL)</label>
              <input
                type="text"
                value={workoutNotes}
                onChange={e => setWorkoutNotes(e.target.value)}
                placeholder={
                  workoutType === 'practice' ? 'e.g. worked on takedowns'
                  : workoutType === 'cardio' ? 'e.g. 3 mile run'
                  : 'e.g. felt strong'
                }
                className={inputClass}
              />
            </div>
          </div>

          {/* Exercises table — lifting only */}
          {workoutType === 'lifting' && (
            <div>
              <label className={labelClass}>EXERCISES</label>
              <div className="border border-[#1a1a1a] overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[520px]">
                  <thead>
                    <tr className="border-b border-[#1a1a1a] bg-[#060606]">
                      {['EXERCISE', 'SETS', 'REPS', 'WEIGHT (LBS)', ''].map((h, i) => (
                        <th key={i} className="font-display text-[9px] tracking-[0.15em] text-[#444] px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#111] last:border-0">
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.name}
                            onChange={e => updateRow(idx, 'name', e.target.value)}
                            placeholder="Squat"
                            className="w-full bg-transparent border-0 text-[#f0f0f0] font-mono text-sm outline-none placeholder-[#333] focus:bg-[#060606] transition-colors px-1 py-1"
                          />
                        </td>
                        <td className="px-2 py-1.5 w-16">
                          <input
                            type="number"
                            value={row.sets}
                            onChange={e => updateRow(idx, 'sets', e.target.value)}
                            min="0"
                            placeholder="3"
                            className="w-full bg-transparent border-0 text-[#f0f0f0] font-mono text-sm outline-none placeholder-[#333] focus:bg-[#060606] transition-colors px-1 py-1"
                          />
                        </td>
                        <td className="px-2 py-1.5 w-16">
                          <input
                            type="number"
                            value={row.reps}
                            onChange={e => updateRow(idx, 'reps', e.target.value)}
                            min="0"
                            placeholder="5"
                            className="w-full bg-transparent border-0 text-[#f0f0f0] font-mono text-sm outline-none placeholder-[#333] focus:bg-[#060606] transition-colors px-1 py-1"
                          />
                        </td>
                        <td className="px-2 py-1.5 w-24">
                          <input
                            type="number"
                            value={row.weight}
                            onChange={e => updateRow(idx, 'weight', e.target.value)}
                            min="0"
                            step="2.5"
                            placeholder="135"
                            className="w-full bg-transparent border-0 text-[#f0f0f0] font-mono text-sm outline-none placeholder-[#333] focus:bg-[#060606] transition-colors px-1 py-1"
                          />
                        </td>
                        <td className="px-2 py-1.5 w-8 text-right">
                          <button
                            type="button"
                            onClick={() => setRows(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))}
                            className="font-mono text-[11px] text-[#333] hover:text-red-500 transition-colors"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setRows(prev => [...prev, { ...EMPTY_ROW }])}
                className="mt-2 font-mono text-[10px] text-[#444] hover:text-[#d97706] tracking-[0.1em] transition-colors"
              >
                + ADD ROW
              </button>
            </div>
          )}

          {submitError && (
            <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className="text-[11px] font-mono text-green-500 border border-green-900/50 bg-green-950/20 px-3 py-2">
              Workout logged.
            </p>
          )}

          <div className="flex gap-3 items-center">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] px-6 py-2.5 hover:bg-[#b45309] transition-colors disabled:opacity-40"
            >
              {submitting ? 'SAVING...' : editingId ? 'UPDATE' : 'LOG WORKOUT'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="font-mono text-[10px] text-[#444] hover:text-[#ccc] tracking-[0.1em] transition-colors"
              >
                CANCEL
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Workout list */}
      <div>
        <div className="text-[10px] font-display tracking-[0.15em] text-[#555] mb-4">PAST WORKOUTS</div>

        {isLoading && page === 0 && (
          <p className="font-mono text-[11px] text-[#444]">Loading...</p>
        )}
        {error && (
          <p className="font-mono text-[11px] text-red-400">{error.message}</p>
        )}
        {!isLoading && allWorkouts.length === 0 && (
          <p className="font-mono text-[11px] text-[#333] tracking-[0.1em]">No workouts logged yet.</p>
        )}

        <div className="space-y-2">
          {allWorkouts.map(workout => {
            const isLifting = (workout.workout_type ?? 'lifting') === 'lifting'
            return (
              <div key={workout.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
                <div className="flex items-center gap-4 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => isLifting && setExpandedId(expandedId === workout.id ? null : workout.id)}
                    className={`flex-1 flex items-center gap-4 text-left ${!isLifting ? 'cursor-default' : ''}`}
                  >
                    <span className="font-mono text-xs text-[#d97706] tracking-[0.05em] w-24 shrink-0">
                      {new Date(workout.workout_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </span>
                    <span className="font-display text-[9px] tracking-[0.15em] text-[#555] shrink-0">
                      {TYPE_LABELS[workout.workout_type ?? 'lifting'].toUpperCase()}
                    </span>
                    {workout.duration_minutes && (
                      <span className="font-mono text-[10px] text-[#444]">
                        {workout.duration_minutes} min
                      </span>
                    )}
                    {workout.notes && (
                      <span className="font-mono text-[11px] text-[#555] truncate">{workout.notes}</span>
                    )}
                    {isLifting && (
                      <span className="font-mono text-[10px] text-[#333] ml-auto">
                        {expandedId === workout.id ? '▲' : '▼'}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => startEdit(workout)}
                    className="font-mono text-[10px] text-[#444] hover:text-[#d97706] tracking-[0.1em] transition-colors"
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(workout.id)}
                    className="font-mono text-[10px] text-[#444] hover:text-red-500 tracking-[0.1em] transition-colors"
                  >
                    DELETE
                  </button>
                </div>

                {isLifting && expandedId === workout.id && (
                  <div className="border-t border-[#111]">
                    <WorkoutExercises workoutId={workout.id} uid={uid} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {hasMore && (
          <button
            onClick={() => setPage(p => p + 1)}
            className="mt-4 font-mono text-[10px] text-[#444] hover:text-[#d97706] tracking-[0.1em] transition-colors border border-[#1a1a1a] px-4 py-2"
          >
            LOAD MORE
          </button>
        )}
      </div>

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-7 max-w-sm w-full">
            <div className="font-display text-[10px] tracking-[0.15em] text-[#d97706] mb-4">DELETE WORKOUT</div>
            <p className="font-mono text-xs text-[#888] mb-6">
              This will permanently delete the workout and all its exercises.
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
                className="font-mono text-[10px] text-[#444] hover:text-[#ccc] tracking-[0.1em] transition-colors"
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
