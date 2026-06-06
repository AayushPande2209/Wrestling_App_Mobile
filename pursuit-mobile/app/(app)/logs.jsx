import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, startOfDay } from 'date-fns'
import { supabase } from '../../lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL

// ─── Shared styles ────────────────────────────────────────────────────────────
const input = StyleSheet.create({
  base: {
    backgroundColor: '#060606',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    color: '#f0f0f0',
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
})

function FieldLabel({ text }) {
  return <Text style={sh.fieldLabel}>{text}</Text>
}

function Card({ children, style }) {
  return <View style={[sh.card, style]}>{children}</View>
}

function CardTitle({ text }) {
  return <Text style={sh.cardTitle}>{text}</Text>
}

function PrimaryBtn({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[sh.primaryBtn, disabled && sh.btnDisabled]}
    >
      <Text style={sh.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  )
}

function useUid() {
  const [uid, setUid] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])
  return uid
}

// ─── Matches tab ──────────────────────────────────────────────────────────────
const WIN_TYPES = ['decision', 'major', 'tech', 'pin', 'forfeit']
const RESULTS = ['win', 'loss', 'draw']
const PAGE_SIZE = 15

function MatchesTab() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [page, setPage] = useState(0)
  const [allMatches, setAllMatches] = useState([])
  const [opponent, setOpponent] = useState('')
  const [result, setResult] = useState('win')
  const [score, setScore] = useState('')
  const [winType, setWinType] = useState('decision')
  const [tournamentId, setTournamentId] = useState('')
  const [newTournamentName, setNewTournamentName] = useState('')
  const [matchDate, setMatchDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  const { data: allResults = [] } = useQuery({
    queryKey: ['matches-record', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('result').eq('wrestler_id', uid)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 60_000,
  })

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournaments').select('id, name, date').eq('wrestler_id', uid).order('date', { ascending: false, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 60_000,
  })

  const { data: pageData, isFetching } = useQuery({
    queryKey: ['matches', uid, page],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('id, match_date, opponent_name, result, score, win_type, tournament, tournament_id, tournaments(name)').eq('wrestler_id', uid).order('match_date', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!pageData) return
    if (page === 0) setAllMatches(pageData)
    else setAllMatches(prev => [...prev, ...pageData])
  }, [pageData])

  async function handleSubmit() {
    if (!opponent.trim()) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      let resolvedTournamentId = tournamentId === '' ? null : tournamentId
      if (tournamentId === '__new__') {
        if (!newTournamentName.trim()) { setSubmitError('Enter a tournament name.'); setSubmitting(false); return }
        const { data: tData, error: tErr } = await supabase.from('tournaments').insert({ wrestler_id: uid, name: newTournamentName.trim() }).select('id').single()
        if (tErr) throw tErr
        resolvedTournamentId = tData.id
        queryClient.invalidateQueries({ queryKey: ['tournaments', uid] })
      }
      const { error } = await supabase.from('matches').insert({
        wrestler_id: uid,
        opponent_name: opponent,
        result,
        score: score || null,
        win_type: result === 'win' ? winType : null,
        tournament_id: resolvedTournamentId,
        match_date: matchDate,
      })
      if (error) throw error
      setOpponent(''); setScore(''); setTournamentId(''); setNewTournamentName('')
      setMatchDate(format(new Date(), 'yyyy-MM-dd'))
      setPage(0); setAllMatches([])
      queryClient.invalidateQueries({ queryKey: ['matches', uid] })
      queryClient.invalidateQueries({ queryKey: ['matches-record', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const wins = allResults.filter(m => m.result === 'win').length
  const losses = allResults.filter(m => m.result === 'loss').length
  const hasMore = pageData?.length === PAGE_SIZE

  return (
    <View style={{ gap: 16 }}>
      {/* Header */}
      <View style={sh.rowBetween}>
        <Text style={sh.pageTitle}>MATCHES</Text>
        <Text style={sh.recordBig}>
          <Text style={{ color: '#22c55e' }}>{wins}</Text>
          <Text style={{ color: '#333' }}> — </Text>
          <Text style={{ color: '#f87171' }}>{losses}</Text>
        </Text>
      </View>

      {/* Add form */}
      <Card>
        <CardTitle text="ADD MATCH" />
        <FieldLabel text="OPPONENT" />
        <TextInput value={opponent} onChangeText={setOpponent} style={input.base} placeholder="Last, First" placeholderTextColor="#2a2a2a" />
        <FieldLabel text="RESULT" />
        <View style={sh.segmented}>
          {RESULTS.map(r => (
            <TouchableOpacity key={r} onPress={() => setResult(r)} style={[sh.seg, result === r && sh.segActive]}>
              <Text style={[sh.segText, result === r && sh.segTextActive]}>{r.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FieldLabel text="SCORE (OPTIONAL)" />
        <TextInput value={score} onChangeText={setScore} style={input.base} placeholder="8-2" placeholderTextColor="#2a2a2a" />
        {result === 'win' && (
          <>
            <FieldLabel text="WIN TYPE" />
            <View style={sh.segmented}>
              {WIN_TYPES.map(t => (
                <TouchableOpacity key={t} onPress={() => setWinType(t)} style={[sh.seg, winType === t && sh.segActive]}>
                  <Text style={[sh.segText, winType === t && sh.segTextActive]}>{t.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <FieldLabel text="DATE" />
        <TextInput value={matchDate} onChangeText={setMatchDate} style={input.base} placeholder="YYYY-MM-DD" placeholderTextColor="#2a2a2a" />
        {submitError && <Text style={sh.errorText}>{submitError}</Text>}
        <PrimaryBtn label={submitting ? 'SAVING...' : 'ADD MATCH'} onPress={handleSubmit} disabled={submitting} />
      </Card>

      {/* List */}
      {allMatches.map(m => (
        <View key={m.id} style={sh.listRow}>
          <View style={{ flex: 1 }}>
            <Text style={sh.listMain}>{m.opponent_name}</Text>
            <Text style={sh.listSub}>{m.match_date} · {m.tournaments?.name ?? m.tournament ?? 'No tournament'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[sh.resultBadge, m.result === 'win' ? { color: '#22c55e' } : m.result === 'loss' ? { color: '#f87171' } : { color: '#aaa' }]}>
              {m.result.toUpperCase()}{m.win_type ? ` · ${m.win_type.toUpperCase()}` : ''}
            </Text>
            {m.score && <Text style={sh.listSub}>{m.score}</Text>}
          </View>
        </View>
      ))}
      {hasMore && (
        <TouchableOpacity onPress={() => setPage(p => p + 1)} disabled={isFetching} style={sh.loadMore}>
          <Text style={sh.loadMoreText}>{isFetching ? 'LOADING...' : 'LOAD MORE'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Notes tab ────────────────────────────────────────────────────────────────
const CONTEXTS = ['general', 'practice', 'match']
const CONTEXT_COLOR = { practice: '#60a5fa', match: '#d97706', general: '#aaa' }

function NotesTab() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [allNotes, setAllNotes] = useState([])
  const [body, setBody] = useState('')
  const [context, setContext] = useState('general')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  const { data: pageData, isFetching } = useQuery({
    queryKey: ['notes', uid, page],
    queryFn: async () => {
      const { data, error } = await supabase.from('notes').select('id, created_at, context, body, match_id').eq('wrestler_id', uid).order('created_at', { ascending: false }).range(page * 20, page * 20 + 19)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!pageData) return
    if (page === 0) setAllNotes(pageData)
    else setAllNotes(prev => [...prev, ...pageData])
  }, [pageData])

  async function handleSubmit() {
    if (!body.trim()) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { error } = await supabase.from('notes').insert({ wrestler_id: session.user.id, body, context })
      if (error) throw error
      setBody('')
      setPage(0); setAllNotes([])
      queryClient.invalidateQueries({ queryKey: ['notes', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = filter === 'all' ? allNotes : allNotes.filter(n => n.context === filter)

  return (
    <View style={{ gap: 16 }}>
      <Text style={sh.pageTitle}>NOTES</Text>
      <Card>
        <CardTitle text="NEW NOTE" />
        <FieldLabel text="CONTEXT" />
        <View style={sh.segmented}>
          {CONTEXTS.map(c => (
            <TouchableOpacity key={c} onPress={() => setContext(c)} style={[sh.seg, context === c && sh.segActive]}>
              <Text style={[sh.segText, context === c && sh.segTextActive]}>{c.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FieldLabel text="NOTE" />
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          style={[input.base, { height: 100, textAlignVertical: 'top' }]}
          placeholder="What did you work on? What needs improvement?"
          placeholderTextColor="#2a2a2a"
        />
        {submitError && <Text style={sh.errorText}>{submitError}</Text>}
        <PrimaryBtn label={submitting ? 'SAVING...' : 'SAVE NOTE'} onPress={handleSubmit} disabled={submitting} />
      </Card>

      {/* Filter */}
      <View style={[sh.segmented, { marginTop: 4 }]}>
        {['all', ...CONTEXTS].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[sh.seg, filter === f && sh.segActive]}>
            <Text style={[sh.segText, filter === f && sh.segTextActive]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map(note => (
        <View key={note.id} style={sh.noteCard}>
          <View style={sh.rowBetween}>
            <Text style={[sh.contextBadge, { color: CONTEXT_COLOR[note.context] ?? '#aaa', borderColor: CONTEXT_COLOR[note.context] ?? '#aaa' }]}>
              {note.context.toUpperCase()}
            </Text>
            <Text style={sh.noteDate}>
              {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
            </Text>
          </View>
          <Text style={sh.noteBody}>{note.body}</Text>
        </View>
      ))}
      {(pageData?.length ?? 0) === 20 && (
        <TouchableOpacity onPress={() => setPage(p => p + 1)} disabled={isFetching} style={sh.loadMore}>
          <Text style={sh.loadMoreText}>{isFetching ? 'LOADING...' : 'LOAD MORE'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Workouts tab ─────────────────────────────────────────────────────────────
const WORKOUT_TYPES = [
  { value: 'lifting', label: 'LIFTING' },
  { value: 'practice', label: 'PRACTICE' },
  { value: 'cardio', label: 'CARDIO' },
  { value: 'other', label: 'OTHER' },
]
const EMPTY_ROW = { name: '', sets: '', reps: '', weight: '' }

function WorkoutsTab() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [page, setPage] = useState(0)
  const [allWorkouts, setAllWorkouts] = useState([])
  const [workoutType, setWorkoutType] = useState('lifting')
  const [workoutDate, setWorkoutDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [durationMinutes, setDurationMinutes] = useState('')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [rows, setRows] = useState([{ ...EMPTY_ROW }])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  const { data: pageData, isLoading, isFetching } = useQuery({
    queryKey: ['workouts', uid, page],
    queryFn: async () => {
      const { data, error } = await supabase.from('workouts').select('id, workout_type, workout_date, duration_minutes, notes, created_at').eq('wrestler_id', uid).order('workout_date', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
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
  }, [pageData])

  function updateRow(idx, field, value) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleSubmit() {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      if (workoutType === 'lifting') {
        const validRows = rows.filter(r => r.name.trim())
        if (!validRows.length) { setSubmitError('Add at least one exercise.'); setSubmitting(false); return }
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
      setWorkoutDate(format(new Date(), 'yyyy-MM-dd'))
      setDurationMinutes(''); setWorkoutNotes(''); setRows([{ ...EMPTY_ROW }])
      setPage(0); setAllWorkouts([])
      queryClient.invalidateQueries({ queryKey: ['workouts', uid] })
      queryClient.invalidateQueries({ queryKey: ['goals', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    Alert.alert('Delete Workout', 'Delete this workout and all its exercises?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('workouts').delete().eq('id', id)
          if (!error) {
            setAllWorkouts(prev => prev.filter(w => w.id !== id))
            queryClient.invalidateQueries({ queryKey: ['workouts', uid] })
          }
        }
      }
    ])
  }

  const hasMore = pageData?.length === PAGE_SIZE

  return (
    <View style={{ gap: 16 }}>
      <Text style={sh.pageTitle}>WORKOUTS</Text>
      <Card>
        <CardTitle text="LOG WORKOUT" />
        <View style={sh.segmented}>
          {WORKOUT_TYPES.map(t => (
            <TouchableOpacity key={t.value} onPress={() => { setWorkoutType(t.value); setRows([{ ...EMPTY_ROW }]) }} style={[sh.seg, workoutType === t.value && sh.segActive]}>
              <Text style={[sh.segText, workoutType === t.value && sh.segTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FieldLabel text="DATE" />
        <TextInput value={workoutDate} onChangeText={setWorkoutDate} style={input.base} placeholder="YYYY-MM-DD" placeholderTextColor="#2a2a2a" />
        <FieldLabel text="DURATION (MIN, OPTIONAL)" />
        <TextInput value={durationMinutes} onChangeText={setDurationMinutes} style={input.base} keyboardType="numeric" placeholder="60" placeholderTextColor="#2a2a2a" />
        <FieldLabel text="NOTES (OPTIONAL)" />
        <TextInput value={workoutNotes} onChangeText={setWorkoutNotes} style={input.base} placeholder="e.g. worked on takedowns" placeholderTextColor="#2a2a2a" />

        {workoutType === 'lifting' && (
          <View style={{ marginTop: 8 }}>
            <FieldLabel text="EXERCISES" />
            {rows.map((row, idx) => (
              <View key={idx} style={sh.exerciseRow}>
                <TextInput
                  value={row.name}
                  onChangeText={v => updateRow(idx, 'name', v)}
                  style={[input.base, { flex: 2 }]}
                  placeholder="Exercise"
                  placeholderTextColor="#2a2a2a"
                />
                <TextInput
                  value={row.sets}
                  onChangeText={v => updateRow(idx, 'sets', v)}
                  style={[input.base, { flex: 0.7 }]}
                  keyboardType="numeric"
                  placeholder="Sets"
                  placeholderTextColor="#333"
                />
                <TextInput
                  value={row.reps}
                  onChangeText={v => updateRow(idx, 'reps', v)}
                  style={[input.base, { flex: 0.7 }]}
                  keyboardType="numeric"
                  placeholder="Reps"
                  placeholderTextColor="#333"
                />
                <TextInput
                  value={row.weight}
                  onChangeText={v => updateRow(idx, 'weight', v)}
                  style={[input.base, { flex: 0.8 }]}
                  keyboardType="decimal-pad"
                  placeholder="Lbs"
                  placeholderTextColor="#333"
                />
                <TouchableOpacity onPress={() => setRows(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))} style={{ paddingHorizontal: 6 }}>
                  <Text style={{ color: '#f87171', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setRows(prev => [...prev, { ...EMPTY_ROW }])} style={sh.addRow}>
              <Text style={sh.addRowText}>+ ADD ROW</Text>
            </TouchableOpacity>
          </View>
        )}

        {submitError && <Text style={sh.errorText}>{submitError}</Text>}
        <PrimaryBtn label={submitting ? 'SAVING...' : 'LOG WORKOUT'} onPress={handleSubmit} disabled={submitting} />
      </Card>

      <Text style={sh.sectionLabel}>PAST WORKOUTS</Text>
      {allWorkouts.map(w => (
        <View key={w.id} style={sh.listRow}>
          <View style={{ flex: 1 }}>
            <Text style={sh.listMain}>
              {new Date(w.workout_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {(w.workout_type ?? 'lifting').toUpperCase()}
            </Text>
            {w.duration_minutes && <Text style={sh.listSub}>{w.duration_minutes} min</Text>}
            {w.notes && <Text style={sh.listSub}>{w.notes}</Text>}
          </View>
          <TouchableOpacity onPress={() => handleDelete(w.id)} style={{ padding: 8 }}>
            <Text style={{ color: '#555', fontSize: 10, fontFamily: 'monospace' }}>DELETE</Text>
          </TouchableOpacity>
        </View>
      ))}
      {hasMore && (
        <TouchableOpacity onPress={() => setPage(p => p + 1)} disabled={isFetching} style={sh.loadMore}>
          <Text style={sh.loadMoreText}>{isFetching ? 'LOADING...' : 'LOAD MORE'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Goals tab ────────────────────────────────────────────────────────────────
const GOAL_TYPES = [
  { value: 'lifting', label: 'Lifting' },
  { value: 'practice', label: 'Practice' },
  { value: 'habit', label: 'Habit' },
  { value: 'tournament_placement', label: 'Tournament' },
  { value: 'other', label: 'Other' },
]
const AUTO_TYPES = new Set(['lifting', 'practice', 'habit'])

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <View style={{ height: 4, backgroundColor: '#1a1a1a', marginTop: 8 }}>
      <View style={{ height: 4, width: `${pct}%`, backgroundColor: pct >= 100 ? '#22c55e' : '#d97706' }} />
    </View>
  )
}

function GoalsTab() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [goalType, setGoalType] = useState('lifting')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('goals').select('id, goal_type, tracking_type, description, target, progress, target_date, completed, completed_at, created_at').eq('wrestler_id', uid).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  const { weekStart, weekEnd } = (() => {
    const now = new Date()
    return { weekStart: startOfWeek(now, { weekStartsOn: 1 }), weekEnd: endOfWeek(now, { weekStartsOn: 1 }) }
  })()

  const { data: weekWorkouts = [] } = useQuery({
    queryKey: ['workouts-week', uid, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase.from('workouts').select('id').eq('wrestler_id', uid).gte('workout_date', format(weekStart, 'yyyy-MM-dd')).lte('workout_date', format(weekEnd, 'yyyy-MM-dd'))
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  const { data: habitLogsRaw = [] } = useQuery({
    queryKey: ['habit-logs-week', uid, weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.from('habit_logs').select('id, goal_id, logged_at').eq('wrestler_id', uid).gte('logged_at', weekStart.toISOString()).lte('logged_at', weekEnd.toISOString())
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 10_000,
  })

  const weekHabitLogs = habitLogsRaw.reduce((acc, log) => {
    if (!acc[log.goal_id]) acc[log.goal_id] = []
    acc[log.goal_id].push(log)
    return acc
  }, {})

  function computeProgress(goal) {
    if (!goal.target || goal.target <= 0) return 0
    let count = 0
    if (goal.goal_type === 'lifting') count = weekWorkouts.length
    else if (goal.goal_type === 'habit') count = (weekHabitLogs[goal.id] ?? []).length
    return Math.min(100, Math.round((count / goal.target) * 100))
  }

  async function handleSubmit() {
    if (!description.trim()) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const trackingType = AUTO_TYPES.has(goalType) ? 'auto' : 'manual'
      const { error } = await supabase.from('goals').insert({
        wrestler_id: uid,
        goal_type: goalType,
        tracking_type: trackingType,
        description: description.trim(),
        target: AUTO_TYPES.has(goalType) && target !== '' ? parseInt(target) : null,
        target_date: targetDate || null,
      })
      if (error) throw error
      setDescription(''); setTarget(''); setTargetDate('')
      queryClient.invalidateQueries({ queryKey: ['goals', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogHabit(goalId) {
    const todayStart = startOfDay(new Date()).toISOString()
    const alreadyLogged = (weekHabitLogs[goalId] ?? []).some(log => log.logged_at >= todayStart)
    if (alreadyLogged) return
    const { error } = await supabase.from('habit_logs').insert({ goal_id: goalId, wrestler_id: uid })
    if (!error) queryClient.invalidateQueries({ queryKey: ['habit-logs-week', uid] })
  }

  async function handleMarkComplete(goalId) {
    const { error } = await supabase.from('goals').update({ completed: true, completed_at: new Date().toISOString(), progress: 100 }).eq('id', goalId)
    if (!error) queryClient.invalidateQueries({ queryKey: ['goals', uid] })
  }

  async function handleDelete(goalId) {
    Alert.alert('Delete Goal', 'Delete this goal and its habit logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('goals').delete().eq('id', goalId)
          if (!error) queryClient.invalidateQueries({ queryKey: ['goals', uid] })
        }
      }
    ])
  }

  const isAuto = AUTO_TYPES.has(goalType)
  const today = new Date().toISOString().split('T')[0]
  const activeGoals = goals.filter(g => !g.completed && (!g.target_date || g.target_date >= today))
  const pastGoals = goals.filter(g => g.completed || (g.target_date && g.target_date < today))

  return (
    <View style={{ gap: 16 }}>
      <Text style={sh.pageTitle}>GOALS</Text>
      <Card>
        <CardTitle text="ADD GOAL" />
        <FieldLabel text="TYPE" />
        <View style={[sh.segmented, { flexWrap: 'wrap' }]}>
          {GOAL_TYPES.map(t => (
            <TouchableOpacity key={t.value} onPress={() => setGoalType(t.value)} style={[sh.seg, goalType === t.value && sh.segActive]}>
              <Text style={[sh.segText, goalType === t.value && sh.segTextActive]}>{t.label.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FieldLabel text="DESCRIPTION" />
        <TextInput value={description} onChangeText={setDescription} style={input.base} placeholder="Describe your goal" placeholderTextColor="#2a2a2a" />
        {isAuto && (
          <>
            <FieldLabel text="WEEKLY TARGET" />
            <TextInput value={target} onChangeText={setTarget} style={input.base} keyboardType="numeric" placeholder="3" placeholderTextColor="#2a2a2a" />
          </>
        )}
        <FieldLabel text="TARGET DATE (OPTIONAL)" />
        <TextInput value={targetDate} onChangeText={setTargetDate} style={input.base} placeholder="YYYY-MM-DD" placeholderTextColor="#2a2a2a" />
        {submitError && <Text style={sh.errorText}>{submitError}</Text>}
        <PrimaryBtn label={submitting ? 'SAVING...' : 'ADD GOAL'} onPress={handleSubmit} disabled={submitting} />
      </Card>

      <Text style={sh.sectionLabel}>
        ACTIVE GOALS — WEEK OF {format(weekStart, 'MMM d')}–{format(weekEnd, 'MMM d')}
      </Text>
      {activeGoals.length === 0 && <Text style={sh.emptyText}>No active goals. Add one above.</Text>}
      {activeGoals.map(goal => {
        const isAutoGoal = AUTO_TYPES.has(goal.goal_type)
        const progress = isAutoGoal ? computeProgress(goal) : (goal.progress ?? 0)
        const todayStart = startOfDay(new Date()).toISOString()
        const alreadyLoggedToday = (weekHabitLogs[goal.id] ?? []).some(l => l.logged_at >= todayStart)
        return (
          <View key={goal.id} style={sh.goalCard}>
            <View style={sh.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={sh.goalType}>{goal.goal_type.replace('_', ' ').toUpperCase()}</Text>
                <Text style={sh.goalDesc}>{goal.description}</Text>
                {goal.target_date && <Text style={sh.listSub}>By {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(goal.id)}>
                <Text style={sh.deleteText}>DELETE</Text>
              </TouchableOpacity>
            </View>
            <ProgressBar value={progress} />
            <Text style={sh.progressText}>{Math.round(progress)}%</Text>
            <View style={[sh.segmented, { marginTop: 8 }]}>
              {goal.goal_type === 'habit' && !goal.completed && (
                <TouchableOpacity onPress={() => handleLogHabit(goal.id)} disabled={alreadyLoggedToday} style={[sh.seg, sh.segActive, alreadyLoggedToday && sh.btnDisabled]}>
                  <Text style={sh.segTextActive}>{alreadyLoggedToday ? 'LOGGED TODAY' : 'LOG TODAY'}</Text>
                </TouchableOpacity>
              )}
              {!isAutoGoal && !goal.completed && (
                <TouchableOpacity onPress={() => handleMarkComplete(goal.id)} style={sh.seg}>
                  <Text style={sh.segText}>MARK COMPLETE</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )
      })}

      {pastGoals.length > 0 && (
        <>
          <Text style={sh.sectionLabel}>PAST GOALS</Text>
          {pastGoals.map(goal => (
            <View key={goal.id} style={[sh.goalCard, { opacity: 0.6 }]}>
              <View style={sh.rowBetween}>
                <Text style={sh.goalDesc}>{goal.description}</Text>
                <Text style={{ color: goal.completed ? '#22c55e' : '#aaa', fontSize: 9, letterSpacing: 3, fontFamily: 'monospace', borderWidth: 1, borderColor: goal.completed ? '#166534' : '#222', paddingHorizontal: 6, paddingVertical: 2 }}>
                  {goal.completed ? 'COMPLETED' : 'MISSED'}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  )
}

// ─── Logs screen (tab container) ──────────────────────────────────────────────
const TABS = ['MATCHES', 'NOTES', 'WORKOUTS', 'GOALS']

export default function Logs() {
  const [activeTab, setActiveTab] = useState('MATCHES')

  return (
    <ScrollView style={sh.root} contentContainerStyle={sh.content}>
      {/* Tab bar */}
      <View style={sh.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[sh.tabBtn, activeTab === tab && sh.tabBtnActive]}
          >
            <Text style={[sh.tabBtnText, activeTab === tab && sh.tabBtnTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'MATCHES' && <MatchesTab />}
      {activeTab === 'NOTES' && <NotesTab />}
      {activeTab === 'WORKOUTS' && <WorkoutsTab />}
      {activeTab === 'GOALS' && <GoalsTab />}
    </ScrollView>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 40 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a', marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#e8712a', marginBottom: -1 },
  tabBtnText: { fontSize: 9, letterSpacing: 4, color: '#555', fontFamily: 'monospace', fontWeight: '500' },
  tabBtnTextActive: { color: '#e8712a' },
  pageTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: '#f0f0f0', fontFamily: 'monospace' },
  card: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 16, gap: 8 },
  cardTitle: { fontSize: 10, letterSpacing: 4, color: '#d97706', fontFamily: 'monospace', marginBottom: 4 },
  fieldLabel: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginTop: 8 },
  primaryBtn: { backgroundColor: '#d97706', paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: 10, letterSpacing: 6, color: '#0a0a0a', fontWeight: 'bold', fontFamily: 'monospace' },
  errorText: { fontSize: 11, color: '#f87171', fontFamily: 'monospace' },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  seg: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#1e1e1e' },
  segActive: { borderColor: '#d97706' },
  segText: { fontSize: 9, letterSpacing: 3, color: '#888', fontFamily: 'monospace' },
  segTextActive: { color: '#d97706' },
  listRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#0a0a0a', paddingHorizontal: 14, paddingVertical: 12 },
  listMain: { fontSize: 13, color: '#ccc', fontFamily: 'monospace' },
  listSub: { fontSize: 10, color: '#555', fontFamily: 'monospace', marginTop: 2 },
  resultBadge: { fontSize: 11, fontWeight: 'bold', letterSpacing: 3, fontFamily: 'monospace' },
  loadMore: { borderWidth: 1, borderColor: '#1e1e1e', padding: 10, alignItems: 'center' },
  loadMoreText: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace' },
  sectionLabel: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginTop: 8 },
  emptyText: { fontSize: 11, color: '#333', fontFamily: 'monospace' },
  noteCard: { borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#0a0a0a', padding: 16 },
  contextBadge: { fontSize: 10, letterSpacing: 3, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, fontFamily: 'monospace' },
  noteDate: { fontSize: 10, color: '#3a3a3a', fontFamily: 'monospace' },
  noteBody: { fontSize: 13, color: '#ccc', fontFamily: 'monospace', lineHeight: 19, marginTop: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordBig: { fontSize: 28, fontWeight: 'bold', fontFamily: 'monospace' },
  exerciseRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  addRow: { borderWidth: 1, borderColor: '#1a1a1a', padding: 10, alignItems: 'center', marginTop: 4 },
  addRowText: { fontSize: 10, letterSpacing: 3, color: '#888', fontFamily: 'monospace' },
  goalCard: { borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#0a0a0a', padding: 16 },
  goalType: { fontSize: 9, letterSpacing: 4, color: '#888', fontFamily: 'monospace', marginBottom: 4 },
  goalDesc: { fontSize: 13, color: '#f0f0f0', fontFamily: 'monospace', lineHeight: 18 },
  progressText: { fontSize: 10, color: '#aaa', fontFamily: 'monospace', marginTop: 4 },
  deleteText: { fontSize: 10, color: '#333', fontFamily: 'monospace', letterSpacing: 2 },
})
