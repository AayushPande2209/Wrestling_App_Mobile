import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import SegmentedControl from '../../components/ui/SegmentedControl'
import Screen from '../../components/ui/Screen'
import { colors, spacing, radii, MIN_TOUCH } from '../../constants/theme'
import Button from '../../components/ui/Button'
import UICard from '../../components/ui/Card'
import AppText from '../../components/ui/AppText'
import { format } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import Stepper from '../../components/Stepper'

const CUSTOM_CONTEXTS_KEY = 'custom_note_contexts'

function parseScore(score) {
  if (!score) return { my: '', their: '' }
  const parts = String(score).split('-')
  return { my: parts[0]?.trim() ?? '', their: parts[1]?.trim() ?? '' }
}

function formatResult(result) {
  if (result === 'win') return 'Win'
  if (result === 'loss') return 'Loss'
  return 'Draw'
}

function formatWinType(winType) {
  if (!winType) return ''
  const map = { decision: 'Dec', major: 'Major', tech: 'Tech', pin: 'Pin', forfeit: 'Forfeit' }
  return map[winType] ?? winType
}

function sentenceCase(value) {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const API_URL = process.env.EXPO_PUBLIC_API_URL

const input = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: radii.sm,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: MIN_TOUCH,
  },
})

function FieldLabel({ text }) {
  return <AppText variant="footnote" style={sh.fieldLabel}>{text}</AppText>
}

function Card({ children, style }) {
  return <UICard style={[{ marginTop: spacing.sm }, style]}>{children}</UICard>
}

function CardTitle({ text }) {
  return <AppText variant="headline" style={sh.cardTitle}>{text}</AppText>
}

function PrimaryBtn({ label, onPress, disabled, loading }) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={{ marginTop: spacing.sm }}
    />
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
const WIN_TYPES = [
  { value: 'decision', label: 'Dec' },
  { value: 'major',    label: 'Major' },
  { value: 'tech',     label: 'Tech' },
  { value: 'pin',      label: 'Pin' },
  { value: 'forfeit',  label: 'Forfeit' },
]
const RESULTS = [
  { value: 'win',  label: 'Win',  activeBg: colors.successMuted, activeBorder: colors.success, activeText: colors.success },
  { value: 'loss', label: 'Loss', activeBg: colors.errorMuted, activeBorder: colors.error, activeText: colors.error },
  { value: 'draw', label: 'Draw', activeBg: colors.accentMuted, activeBorder: colors.accent, activeText: colors.accent },
]
const PAGE_SIZE = 15

function MatchesTab() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [page, setPage] = useState(0)
  const [allMatches, setAllMatches] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [opponent, setOpponent] = useState('')
  const [result, setResult] = useState('win')
  const [myScore, setMyScore] = useState('')
  const [theirScore, setTheirScore] = useState('')
  const [winType, setWinType] = useState('decision')
  const [lossForfeit, setLossForfeit] = useState(false)
  const [tournamentId, setTournamentId] = useState('')
  const [newTournamentName, setNewTournamentName] = useState('')
  const [matchDate, setMatchDate] = useState(new Date())
  const [showMatchDatePicker, setShowMatchDatePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const isForfeit = (result === 'win' && winType === 'forfeit') || (result === 'loss' && lossForfeit)

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

  function resetForm() {
    setEditingId(null)
    setOpponent('')
    setResult('win')
    setMyScore('')
    setTheirScore('')
    setWinType('decision')
    setLossForfeit(false)
    setTournamentId('')
    setNewTournamentName('')
    setMatchDate(new Date())
    setSubmitError(null)
  }

  function startEdit(match) {
    setEditingId(match.id)
    setOpponent(match.opponent_name ?? '')
    setResult(match.result ?? 'win')
    const isLossFf = match.result === 'loss' && match.win_type === 'forfeit'
    const isWinFf = match.result === 'win' && match.win_type === 'forfeit'
    setWinType(isWinFf ? 'forfeit' : (match.win_type ?? 'decision'))
    setLossForfeit(isLossFf)
    if (!isWinFf && !isLossFf) {
      const { my, their } = parseScore(match.score)
      setMyScore(my)
      setTheirScore(their)
    } else {
      setMyScore('')
      setTheirScore('')
    }
    setTournamentId(match.tournament_id ?? '')
    setMatchDate(match.match_date ? new Date(match.match_date + 'T00:00:00') : new Date())
    setSubmitError(null)
  }

  async function handleSubmit() {
    if (!opponent.trim()) { setSubmitError('Opponent name is required.'); return }
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
      const scoreStr = isForfeit ? null : (myScore.trim() && theirScore.trim() ? `${myScore.trim()}-${theirScore.trim()}` : null)
      const resolvedWinType = result === 'win'
        ? winType
        : (result === 'loss' && lossForfeit ? 'forfeit' : null)
      const payload = {
        opponent_name: opponent.trim(),
        result,
        score: scoreStr,
        win_type: resolvedWinType,
        tournament_id: resolvedTournamentId,
        match_date: format(matchDate, 'yyyy-MM-dd'),
      }
      const { error } = editingId
        ? await supabase.from('matches').update(payload).eq('id', editingId)
        : await supabase.from('matches').insert({ wrestler_id: uid, ...payload })
      if (error) throw error
      resetForm()
      setPage(0); setAllMatches([])
      queryClient.invalidateQueries({ queryKey: ['matches', uid] })
      queryClient.invalidateQueries({ queryKey: ['matches-record', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    Alert.alert('Delete match', 'Remove this match from your log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('matches').delete().eq('id', id)
          if (!error) {
            if (editingId === id) resetForm()
            setAllMatches(prev => prev.filter(m => m.id !== id))
            queryClient.invalidateQueries({ queryKey: ['matches', uid] })
            queryClient.invalidateQueries({ queryKey: ['matches-record', uid] })
          }
        },
      },
    ])
  }

  const wins = allResults.filter(m => m.result === 'win').length
  const losses = allResults.filter(m => m.result === 'loss').length
  const hasMore = pageData?.length === PAGE_SIZE

  return (
    <View style={{ gap: 16 }}>
      {/* Header */}
      <View style={sh.rowBetween}>
        <AppText variant="title2" style={sh.pageTitle}>Matches</AppText>
        <Text style={sh.recordBig}>
          <Text style={{ color: '#22c55e' }}>{wins}</Text>
          <Text style={{ color: '#333' }}> — </Text>
          <Text style={{ color: '#f87171' }}>{losses}</Text>
        </Text>
      </View>

      {/* Add form */}
      <Card>
        <CardTitle text={editingId ? 'Edit match' : 'Add match'} />
        <FieldLabel text="Opponent" />
        <TextInput value={opponent} onChangeText={setOpponent} style={input.base} placeholder="Last, First" placeholderTextColor={colors.textTertiary} />
        <FieldLabel text="Result" />
        <View style={sh.resultRow}>
          {RESULTS.map(r => {
            const active = result === r.value
            return (
              <TouchableOpacity
                key={r.value}
                onPress={() => {
                  setResult(r.value)
                  if (r.value === 'draw') { setLossForfeit(false); setWinType('decision') }
                  if (r.value === 'loss') setWinType('decision')
                }}
                activeOpacity={0.7}
                style={[sh.resultBtn, active
                  ? { backgroundColor: r.activeBg, borderColor: r.activeBorder }
                  : sh.resultBtnInactive
                ]}
              >
                <Text style={[sh.resultBtnText, { color: active ? r.activeText : colors.textSecondary }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        {result === 'win' && (
          <>
            <FieldLabel text="Win type" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.winTypeRow}>
              {WIN_TYPES.map(t => {
                const active = winType === t.value
                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => {
                      setWinType(t.value)
                      if (t.value === 'forfeit') { setMyScore(''); setTheirScore('') }
                    }}
                    activeOpacity={0.7}
                    style={[sh.winTypeBtn, active && sh.winTypeBtnActive]}
                  >
                    <Text style={[sh.winTypeBtnText, active && sh.winTypeBtnTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </>
        )}
        {result === 'loss' && (
          <>
            <FieldLabel text="Forfeit" />
            <TouchableOpacity
              onPress={() => {
                setLossForfeit(v => !v)
                if (!lossForfeit) { setMyScore(''); setTheirScore('') }
              }}
              activeOpacity={0.7}
              style={[sh.winTypeBtn, lossForfeit && sh.winTypeBtnActive, { alignSelf: 'flex-start', marginTop: spacing.xs }]}
            >
              <Text style={[sh.winTypeBtnText, lossForfeit && sh.winTypeBtnTextActive]}>I forfeited</Text>
            </TouchableOpacity>
          </>
        )}
        {!isForfeit && result !== 'draw' && (
          <>
            <FieldLabel text="Score (optional)" />
            <View style={sh.scoreRow}>
              <TextInput
                value={myScore}
                onChangeText={setMyScore}
                keyboardType="numeric"
                maxLength={2}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                style={sh.scoreInput}
              />
              <Text style={sh.scoreDash}>—</Text>
              <TextInput
                value={theirScore}
                onChangeText={setTheirScore}
                keyboardType="numeric"
                maxLength={2}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                style={sh.scoreInput}
              />
            </View>
          </>
        )}
        <FieldLabel text="Date" />
        <TouchableOpacity onPress={() => setShowMatchDatePicker(true)} activeOpacity={0.7} style={sh.dateBtn}>
          <Text style={sh.dateBtnText}>{format(matchDate, 'MMM d, yyyy')}</Text>
          <Ionicons name="calendar-outline" size={16} color={colors.accent} />
        </TouchableOpacity>
        {showMatchDatePicker && (
          <DateTimePicker
            value={matchDate}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            themeVariant="dark"
            onChange={(_, date) => { setShowMatchDatePicker(false); if (date) setMatchDate(date) }}
          />
        )}
        {submitError && <Text style={sh.errorText}>{submitError}</Text>}
        <PrimaryBtn label={submitting ? 'Saving…' : (editingId ? 'Update match' : 'Add match')} onPress={handleSubmit} disabled={submitting} loading={submitting} />
        {editingId ? (
          <Button label="Cancel edit" variant="ghost" onPress={resetForm} style={{ marginTop: spacing.xs }} />
        ) : null}
      </Card>

      {allMatches.map(m => (
        <View key={m.id} style={sh.listRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => startEdit(m)} activeOpacity={0.7}>
            <Text style={sh.listMain}>{m.opponent_name}</Text>
            <Text style={sh.listSub}>{m.match_date} · {m.tournaments?.name ?? m.tournament ?? 'No tournament'}</Text>
            <Text style={[sh.resultBadge, { marginTop: 4 }, m.result === 'win' ? { color: colors.success } : m.result === 'loss' ? { color: colors.error } : { color: colors.textSecondary }]}>
              {formatResult(m.result)}{m.win_type ? ` · ${formatWinType(m.win_type)}` : ''}
              {m.score ? ` · ${m.score}` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(m.id)} style={{ padding: 8 }}>
            <AppText variant="caption" color={colors.textTertiary}>Delete</AppText>
          </TouchableOpacity>
        </View>
      ))}
      {hasMore && (
        <TouchableOpacity onPress={() => setPage(p => p + 1)} disabled={isFetching} style={sh.loadMore}>
          <Text style={sh.loadMoreText}>{isFetching ? 'Loading…' : 'Load more'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Notes tab ────────────────────────────────────────────────────────────────
const CONTEXTS = ['general', 'practice', 'match']
const CONTEXT_COLOR = { practice: '#60a5fa', match: colors.accent, general: colors.textSecondary }

function NotesTab() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [allNotes, setAllNotes] = useState([])
  const [body, setBody] = useState('')
  const [context, setContext] = useState('general')
  const [editingId, setEditingId] = useState(null)
  const [customContexts, setCustomContexts] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const allContexts = [...CONTEXTS, ...customContexts]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
    AsyncStorage.getItem(CUSTOM_CONTEXTS_KEY).then(raw => {
      if (raw) {
        try { setCustomContexts(JSON.parse(raw)) } catch { /* ignore */ }
      }
    })
  }, [])

  async function saveCustomContexts(next) {
    setCustomContexts(next)
    await AsyncStorage.setItem(CUSTOM_CONTEXTS_KEY, JSON.stringify(next))
  }

  function addCategory() {
    const slug = newCategory.trim().toLowerCase().replace(/\s+/g, '_')
    if (!slug || allContexts.includes(slug)) return
    const next = [...customContexts, slug]
    saveCustomContexts(next)
    setNewCategory('')
    setContext(slug)
  }

  function resetNoteForm() {
    setEditingId(null)
    setBody('')
    setContext('general')
    setSubmitError(null)
  }

  function startEditNote(note) {
    setEditingId(note.id)
    setBody(note.body ?? '')
    setContext(note.context ?? 'general')
    setSubmitError(null)
  }

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
      const { error } = editingId
        ? await supabase.from('notes').update({ body: body.trim(), context }).eq('id', editingId)
        : await supabase.from('notes').insert({ wrestler_id: session.user.id, body: body.trim(), context })
      if (error) throw error
      resetNoteForm()
      setPage(0); setAllNotes([])
      queryClient.invalidateQueries({ queryKey: ['notes', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteNote(id) {
    Alert.alert('Delete note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('notes').delete().eq('id', id)
          if (!error) {
            if (editingId === id) resetNoteForm()
            setAllNotes(prev => prev.filter(n => n.id !== id))
            queryClient.invalidateQueries({ queryKey: ['notes', uid] })
          }
        },
      },
    ])
  }

  const filtered = filter === 'all' ? allNotes : allNotes.filter(n => n.context === filter)

  return (
    <View style={{ gap: 16 }}>
      <AppText variant="title2" style={sh.pageTitle}>Notes</AppText>
      <Card>
        <CardTitle text={editingId ? 'Edit note' : 'New note'} />
        <FieldLabel text="Context" />
        <View style={sh.segmented}>
          {allContexts.map(c => (
            <TouchableOpacity key={c} onPress={() => setContext(c)} style={[sh.seg, context === c && sh.segActive]}>
              <Text style={[sh.segText, context === c && sh.segTextActive]}>{sentenceCase(c.replace(/_/g, ' '))}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={sh.addCategoryRow}>
          <TextInput
            value={newCategory}
            onChangeText={setNewCategory}
            style={[input.base, { flex: 1 }]}
            placeholder="New category"
            placeholderTextColor={colors.textTertiary}
          />
          <Button label="Add" variant="ghost" onPress={addCategory} style={{ marginTop: 0 }} />
        </View>
        <FieldLabel text="Note" />
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          style={[input.base, { height: 100, textAlignVertical: 'top' }]}
          placeholder="What did you work on? What needs improvement?"
          placeholderTextColor={colors.textTertiary}
        />
        {submitError && <Text style={sh.errorText}>{submitError}</Text>}
        <PrimaryBtn label={submitting ? 'Saving…' : (editingId ? 'Update note' : 'Save note')} onPress={handleSubmit} disabled={submitting} loading={submitting} />
        {editingId ? (
          <Button label="Cancel edit" variant="ghost" onPress={resetNoteForm} style={{ marginTop: spacing.xs }} />
        ) : null}
      </Card>

      <View style={[sh.segmented, { marginTop: 4 }]}>
        {['all', ...allContexts].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[sh.seg, filter === f && sh.segActive]}>
            <Text style={[sh.segText, filter === f && sh.segTextActive]}>
              {f === 'all' ? 'All' : sentenceCase(f.replace(/_/g, ' '))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map(note => (
        <TouchableOpacity key={note.id} onPress={() => startEditNote(note)} activeOpacity={0.7} style={sh.noteCard}>
          <View style={sh.rowBetween}>
            <Text style={[sh.contextBadge, { color: CONTEXT_COLOR[note.context] ?? colors.textSecondary, borderColor: CONTEXT_COLOR[note.context] ?? colors.separator }]}>
              {sentenceCase((note.context ?? 'general').replace(/_/g, ' '))}
            </Text>
            <Text style={sh.noteDate}>
              {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <Text style={sh.noteBody}>{note.body}</Text>
          <TouchableOpacity onPress={() => handleDeleteNote(note.id)} style={{ marginTop: spacing.sm }}>
            <AppText variant="caption" color={colors.textTertiary}>Delete</AppText>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      {(pageData?.length ?? 0) === 20 && (
        <TouchableOpacity onPress={() => setPage(p => p + 1)} disabled={isFetching} style={sh.loadMore}>
          <Text style={sh.loadMoreText}>{isFetching ? 'Loading…' : 'Load more'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Workouts tab ─────────────────────────────────────────────────────────────
const WORKOUT_TYPES = [
  { value: 'lifting', label: 'Lifting' },
  { value: 'practice', label: 'Practice' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'other', label: 'Other' },
]
const EMPTY_ROW = { name: '', sets: 3, reps: 10, weight: 45 }

function WorkoutsTab() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [page, setPage] = useState(0)
  const [allWorkouts, setAllWorkouts] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [workoutType, setWorkoutType] = useState('lifting')
  const [workoutDate, setWorkoutDate] = useState(new Date())
  const [showWorkoutDatePicker, setShowWorkoutDatePicker] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState('')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [rows, setRows] = useState([{ ...EMPTY_ROW }])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [pastExercises, setPastExercises] = useState([])
  const [focusedRowIdx, setFocusedRowIdx] = useState(null)

  function resetWorkoutForm() {
    setEditingId(null)
    setWorkoutType('lifting')
    setWorkoutDate(new Date())
    setDurationMinutes('')
    setWorkoutNotes('')
    setRows([{ ...EMPTY_ROW }])
    setSubmitError(null)
  }

  async function startEditWorkout(workout) {
    setEditingId(workout.id)
    setWorkoutType(workout.workout_type ?? 'lifting')
    setWorkoutDate(workout.workout_date ? new Date(workout.workout_date + 'T00:00:00') : new Date())
    setDurationMinutes(workout.duration_minutes != null ? String(workout.duration_minutes) : '')
    setWorkoutNotes(workout.notes ?? '')
    setSubmitError(null)
    if ((workout.workout_type ?? 'lifting') === 'lifting') {
      const { data } = await supabase
        .from('workout_exercises')
        .select('name, sets, reps, weight')
        .eq('workout_id', workout.id)
        .order('id')
      setRows(data?.length ? data.map(e => ({ name: e.name, sets: e.sets, reps: e.reps, weight: e.weight })) : [{ ...EMPTY_ROW }])
    } else {
      setRows([{ ...EMPTY_ROW }])
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setUid(session.user.id)
      const { data } = await supabase
        .from('workout_exercises')
        .select('name')
        .eq('wrestler_id', session.user.id)
        .order('name')
      if (data) setPastExercises([...new Set(data.map(e => e.name))])
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

      if (editingId) {
        await supabase.from('workout_exercises').delete().eq('workout_id', editingId)
        const payload = {
          workout_type: workoutType,
          workout_date: format(workoutDate, 'yyyy-MM-dd'),
          duration_minutes: durationMinutes !== '' ? parseInt(durationMinutes, 10) : null,
          notes: workoutNotes || null,
        }
        const { error: updateErr } = await supabase.from('workouts').update(payload).eq('id', editingId)
        if (updateErr) throw updateErr
        if (workoutType === 'lifting') {
          const validRows = rows.filter(r => r.name.trim())
          if (!validRows.length) { setSubmitError('Add at least one exercise.'); setSubmitting(false); return }
          const { error: exErr } = await supabase.from('workout_exercises').insert(
            validRows.map(r => ({
              workout_id: editingId,
              wrestler_id: uid,
              name: r.name.trim(),
              sets: r.sets,
              reps: r.reps,
              weight: r.weight,
            }))
          )
          if (exErr) throw exErr
        }
      } else if (workoutType === 'lifting') {
        const validRows = rows.filter(r => r.name.trim())
        if (!validRows.length) { setSubmitError('Add at least one exercise.'); setSubmitting(false); return }
        const { error: rpcErr } = await supabase.rpc('insert_lifting_workout', {
          p_workout_date: format(workoutDate, 'yyyy-MM-dd'),
          p_notes: workoutNotes || null,
          p_exercises: validRows.map(r => ({
            name: r.name.trim(),
            sets: r.sets,
            reps: r.reps,
            weight: r.weight,
          })),
        })
        if (rpcErr) throw rpcErr
      } else {
        const { error } = await supabase.from('workouts').insert({
          wrestler_id: uid,
          workout_type: workoutType,
          workout_date: format(workoutDate, 'yyyy-MM-dd'),
          duration_minutes: durationMinutes !== '' ? parseInt(durationMinutes, 10) : null,
          notes: workoutNotes || null,
        })
        if (error) throw error
      }
      resetWorkoutForm()
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
    Alert.alert('Delete workout', 'Delete this workout and all its exercises?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('workouts').delete().eq('id', id)
          if (!error) {
            if (editingId === id) resetWorkoutForm()
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
      <AppText variant="title2" style={sh.pageTitle}>Workouts</AppText>
      <Card>
        <CardTitle text={editingId ? 'Edit workout' : 'Log workout'} />
        <View style={sh.segmented}>
          {WORKOUT_TYPES.map(t => (
            <TouchableOpacity key={t.value} onPress={() => { setWorkoutType(t.value); setRows([{ ...EMPTY_ROW }]) }} style={[sh.seg, workoutType === t.value && sh.segActive]}>
              <Text style={[sh.segText, workoutType === t.value && sh.segTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FieldLabel text="Date" />
        <TouchableOpacity onPress={() => setShowWorkoutDatePicker(true)} activeOpacity={0.7} style={sh.dateBtn}>
          <Text style={sh.dateBtnText}>{format(workoutDate, 'MMM d, yyyy')}</Text>
          <Ionicons name="calendar-outline" size={16} color={colors.accent} />
        </TouchableOpacity>
        {showWorkoutDatePicker && (
          <DateTimePicker
            value={workoutDate}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            themeVariant="dark"
            onChange={(_, date) => { setShowWorkoutDatePicker(false); if (date) setWorkoutDate(date) }}
          />
        )}
        <FieldLabel text="Duration (min, optional)" />
        <TextInput value={durationMinutes} onChangeText={setDurationMinutes} style={input.base} keyboardType="numeric" placeholder="60" placeholderTextColor={colors.textTertiary} />
        <FieldLabel text="Notes (optional)" />
        <TextInput value={workoutNotes} onChangeText={setWorkoutNotes} style={input.base} placeholder="e.g. worked on takedowns" placeholderTextColor={colors.textTertiary} />

        {workoutType === 'lifting' && (
          <View style={{ marginTop: 8 }}>
            <FieldLabel text="Exercises" />
            {rows.map((row, idx) => (
              <View key={idx}>
                <View style={sh.exerciseRow}>
                  <TextInput
                    value={row.name}
                    onChangeText={v => updateRow(idx, 'name', v)}
                    onFocus={() => setFocusedRowIdx(idx)}
                    onBlur={() => setFocusedRowIdx(null)}
                    style={[input.base, { flex: 1 }]}
                    placeholder="Exercise"
                    placeholderTextColor="#2a2a2a"
                  />
                  <TouchableOpacity onPress={() => setRows(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))} style={{ paddingHorizontal: 4 }}>
                    <Text style={{ color: '#f87171', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {focusedRowIdx === idx && row.name.length > 0 && (() => {
                  const suggestions = pastExercises.filter(n =>
                    n.toLowerCase().startsWith(row.name.toLowerCase()) &&
                    n.toLowerCase() !== row.name.toLowerCase()
                  ).slice(0, 4)
                  if (!suggestions.length) return null
                  return (
                    <View style={sh.suggestions}>
                      {suggestions.map(s => (
                        <TouchableOpacity
                          key={s}
                          onPress={() => { updateRow(idx, 'name', s); setFocusedRowIdx(null) }}
                          style={sh.suggestion}
                        >
                          <Text style={sh.suggestionText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )
                })()}
              <View style={sh.stepperRow}>
                <View style={sh.stepperCol}>
                  <Text style={sh.stepperLabel}>Sets</Text>
                  <Stepper value={row.sets} onChange={v => updateRow(idx, 'sets', v)} min={1} max={20} step={1} />
                </View>
                <View style={sh.stepperCol}>
                  <Text style={sh.stepperLabel}>Reps</Text>
                  <Stepper value={row.reps} onChange={v => updateRow(idx, 'reps', v)} min={1} max={50} step={1} />
                </View>
                <View style={sh.stepperCol}>
                  <Text style={sh.stepperLabel}>Weight</Text>
                  <Stepper value={row.weight} onChange={v => updateRow(idx, 'weight', v)} min={0} max={1000} step={5} suffix=" lbs" />
                </View>
              </View>
            </View>
            ))}
            <TouchableOpacity onPress={() => setRows(prev => [...prev, { ...EMPTY_ROW }])} style={sh.addRow}>
              <Text style={sh.addRowText}>+ Add row</Text>
            </TouchableOpacity>
          </View>
        )}

        {submitError && <Text style={sh.errorText}>{submitError}</Text>}
        <PrimaryBtn label={submitting ? 'Saving…' : (editingId ? 'Update workout' : 'Log workout')} onPress={handleSubmit} disabled={submitting} />
        {editingId ? (
          <Button label="Cancel edit" variant="ghost" onPress={resetWorkoutForm} style={{ marginTop: spacing.xs }} />
        ) : null}
      </Card>

      <AppText variant="headline" style={sh.sectionLabel}>Past workouts</AppText>
      {allWorkouts.map(w => (
        <TouchableOpacity key={w.id} onPress={() => startEditWorkout(w)} activeOpacity={0.7} style={sh.listRow}>
          <View style={{ flex: 1 }}>
            <Text style={sh.listMain}>
              {new Date(w.workout_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {sentenceCase(w.workout_type ?? 'lifting')}
            </Text>
            {w.duration_minutes ? <Text style={sh.listSub}>{w.duration_minutes} min</Text> : null}
            {w.notes ? <Text style={sh.listSub}>{w.notes}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => handleDelete(w.id)} style={{ padding: 8 }}>
            <AppText variant="footnote" color={colors.textTertiary}>Delete</AppText>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      {hasMore && (
        <TouchableOpacity onPress={() => setPage(p => p + 1)} disabled={isFetching} style={sh.loadMore}>
          <Text style={sh.loadMoreText}>{isFetching ? 'Loading…' : 'Load more'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Log screen (tab container) ─────────────────────────────────────────────
const VALID_TABS = ['MATCHES', 'NOTES', 'WORKOUTS']
const SEGMENT_OPTIONS = [
  { value: 'MATCHES', label: 'Matches' },
  { value: 'NOTES', label: 'Notes' },
  { value: 'WORKOUTS', label: 'Workouts' },
]

export default function Log() {
  const { tab } = useLocalSearchParams()
  const router = useRouter()
  const activeTab = VALID_TABS.includes(tab) ? tab : 'MATCHES'

  function setTab(next) {
    router.setParams({ tab: next })
  }

  return (
    <Screen scroll contentStyle={{ paddingTop: spacing.md }}>
      <SegmentedControl options={SEGMENT_OPTIONS} value={activeTab} onChange={setTab} />
      {activeTab === 'MATCHES' && <MatchesTab />}
      {activeTab === 'NOTES' && <NotesTab />}
      {activeTab === 'WORKOUTS' && <WorkoutsTab />}
    </Screen>
  )
}

const sh = StyleSheet.create({
  root:            { flex: 1, backgroundColor: colors.bg },
  content:         { padding: spacing.md, paddingBottom: 40 },
  pageTitle:       { marginBottom: spacing.sm },
  card:            {},
  cardTitle:       { marginBottom: spacing.xs },
  fieldLabel:      { marginTop: spacing.sm, marginBottom: spacing.xs },
  primaryBtn:      {},
  btnDisabled:     { opacity: 0.45 },
  primaryBtnText:  {},
  errorText:       { fontSize: 15, color: colors.error, marginTop: spacing.sm },
  segmented:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  seg:             { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, borderRadius: radii.sm, minHeight: MIN_TOUCH, justifyContent: 'center' },
  segActive:       { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  segText:         { fontSize: 15, color: colors.textSecondary },
  segTextActive:   { color: colors.accent, fontWeight: '600' },
  dateBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: 12, minHeight: MIN_TOUCH },
  dateBtnText:     { fontSize: 17, color: colors.text },
  resultRow:       { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  resultBtn:       { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.sm },
  resultBtnInactive: { backgroundColor: colors.surfaceElevated, borderColor: colors.separator },
  resultBtnText:   { fontSize: 15, fontWeight: '600' },
  winTypeRow:      { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  winTypeBtn:      { paddingHorizontal: spacing.md, minHeight: MIN_TOUCH - 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, borderRadius: radii.full },
  winTypeBtnActive:{ backgroundColor: colors.accentMuted, borderColor: colors.accent },
  winTypeBtnText:  { fontSize: 15, color: colors.textSecondary },
  winTypeBtnTextActive: { color: colors.accent, fontWeight: '600' },
  scoreRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreInput:      { width: 72, backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, borderRadius: radii.sm, color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center', paddingVertical: 10, minHeight: MIN_TOUCH, fontVariant: ['tabular-nums'] },
  scoreDash:       { fontSize: 22, color: colors.textSecondary, fontWeight: '700' },
  listRow:         { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, backgroundColor: colors.surface, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  listMain:        { fontSize: 17, color: colors.text },
  listSub:         { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  resultBadge:     { fontSize: 15, fontWeight: '600' },
  loadMore:        { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', minHeight: MIN_TOUCH, justifyContent: 'center' },
  loadMoreText:    { fontSize: 15, color: colors.textSecondary },
  sectionLabel:    { marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText:       { fontSize: 15, color: colors.textTertiary },
  noteCard:        { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm },
  contextBadge:    { fontSize: 13, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  noteDate:        { fontSize: 13, color: colors.textTertiary },
  noteBody:        { fontSize: 17, color: colors.text, lineHeight: 22, marginTop: spacing.sm },
  rowBetween:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordBig:       { fontSize: 28, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  exerciseRow:     { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', marginBottom: 0 },
  suggestions:     { backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 0, borderColor: colors.separator, borderRadius: radii.sm, marginBottom: spacing.xs },
  suggestion:      { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, minHeight: MIN_TOUCH, justifyContent: 'center' },
  suggestionText:  { fontSize: 15, color: colors.textSecondary },
  stepperRow:      { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, marginBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  stepperCol:      { alignItems: 'center', gap: spacing.xs },
  stepperLabel:    { fontSize: 13, color: colors.textSecondary },
  addCategoryRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  addRow:          { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs, minHeight: MIN_TOUCH, justifyContent: 'center' },
  addRowText:      { fontSize: 15, color: colors.textSecondary },
  deleteText:      { fontSize: 13, color: colors.textTertiary },
})
