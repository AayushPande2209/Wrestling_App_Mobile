import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Dimensions,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Polyline, Circle, Line, Text as SvgText, Rect, G } from 'react-native-svg'
import { supabase } from '../../lib/supabase'
import WheelPicker from '../../components/WheelPicker'
import Button from '../../components/ui/Button'
import Toast from '../../components/ui/Toast'
import { formatWeight, formatTimeOfDay } from '../../lib/formatWeight'
import { colors, spacing, radii, MIN_TOUCH } from '../../constants/theme'

const SCREEN_WIDTH = Dimensions.get('window').width

const TIME_OF_DAY = [
  { value: 'morning',   icon: 'sunny-outline',   label: 'Morning' },
  { value: 'afternoon', icon: 'partly-sunny-outline', label: 'Afternoon' },
  { value: 'night',     icon: 'moon-outline',    label: 'Night' },
]

function WeightChart({ data }) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const W = SCREEN_WIDTH - spacing.md * 4
  const H = 200
  const PAD = { top: 16, right: 12, bottom: 32, left: 44 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const weights = data.map(d => d.weight)
  const minW = Math.min(...weights) - 0.5
  const maxW = Math.max(...weights) + 0.5
  const range = maxW - minW || 1

  const toX = i => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW
  const toY = w => PAD.top + (1 - (w - minW) / range) * innerH

  const points = data.map((d, i) => `${toX(i)},${toY(d.weight)}`).join(' ')
  const yTicks = [minW, minW + range * 0.5, maxW]
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))

  const TIP_W = 88
  const TIP_H = 40

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Daily average · last {data.length} days</Text>
      <Svg width={W} height={H}>
        <Line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} stroke={colors.separator} strokeWidth={1} />
        <Line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke={colors.separator} strokeWidth={1} />

        {yTicks.map((v, i) => (
          <G key={`y-${i}`}>
            <Line x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)} stroke={colors.separator} strokeDasharray="3,4" strokeOpacity={0.6} />
            <SvgText x={PAD.left - 6} y={toY(v) + 4} fontSize="11" fill={colors.textSecondary} textAnchor="end">{formatWeight(v)}</SvgText>
          </G>
        ))}

        <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth="2.5" />

        {data.map((d, i) => (
          <G key={i}>
            <Circle cx={toX(i)} cy={toY(d.weight)} r={selectedIdx === i ? 6 : 4} fill={selectedIdx === i ? colors.text : colors.accent} />
            <Circle cx={toX(i)} cy={toY(d.weight)} r="18" fill="transparent"
              onPress={() => setSelectedIdx(selectedIdx === i ? null : i)} />
          </G>
        ))}

        {data.map((d, i) => {
          if (i % labelEvery !== 0 && i !== data.length - 1) return null
          return (
            <SvgText key={`x-${i}`} x={toX(i)} y={H - 8} fontSize="10" fill={colors.textSecondary} textAnchor="middle">{d.date}</SvgText>
          )
        })}

        {selectedIdx !== null && (() => {
          const cx = toX(selectedIdx)
          const cy = toY(data[selectedIdx].weight)
          const tx = Math.min(Math.max(cx - TIP_W / 2, PAD.left), W - PAD.right - TIP_W)
          const ty = Math.max(cy - TIP_H - 12, PAD.top)
          return (
            <G>
              <Rect x={tx} y={ty} width={TIP_W} height={TIP_H} rx="8" fill={colors.surfaceElevated} stroke={colors.accent} strokeWidth="1" />
              <SvgText x={tx + TIP_W / 2} y={ty + 16} fontSize="13" fill={colors.text} textAnchor="middle" fontWeight="600">
                {formatWeight(data[selectedIdx].weight)} lbs
              </SvgText>
              <SvgText x={tx + TIP_W / 2} y={ty + 30} fontSize="10" fill={colors.textSecondary} textAnchor="middle">
                {data[selectedIdx].date}
              </SvgText>
            </G>
          )
        })()}
      </Svg>
    </View>
  )
}

export default function WeightLog() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [weight, setWeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState(null)
  const [timeOfDay, setTimeOfDay] = useState('morning')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  const [wrestler, setWrestler] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setUid(session.user.id)
      const { data } = await supabase.from('wrestlers')
        .select('current_weight, weight_class')
        .eq('id', session.user.id)
        .single()
      setWrestler(data)
      const w = data?.current_weight != null ? String(data.current_weight) : '150.0'
      setCurrentWeight(w)
      setWeight(w)
    })
  }, [])

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['weight-logs', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('weight_logs').select('weight, time_of_day, logged_at, note').eq('wrestler_id', uid).order('logged_at', { ascending: true }).limit(90)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  async function handleLog() {
    if (!weight || !timeOfDay) return
    const parsedWeight = parseFloat(weight)
    if (isNaN(parsedWeight)) { setSubmitError('Enter a valid weight'); return }
    setSubmitError(null)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      const { error } = await supabase.from('weight_logs').insert({
        wrestler_id: uid,
        weight: parsedWeight,
        time_of_day: timeOfDay,
        note: note || null,
        logged_at: new Date().toISOString(),
      })
      if (error) throw error
      await supabase.from('wrestlers').update({ current_weight: parsedWeight }).eq('id', uid)
      setWrestler(prev => prev ? { ...prev, current_weight: parsedWeight } : prev)
      setTimeOfDay('morning')
      setNote('')
      setToastMessage('Weight logged')
      queryClient.invalidateQueries({ queryKey: ['weight-logs', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const rawCut = wrestler?.current_weight != null && wrestler?.weight_class != null
    ? wrestler.current_weight - wrestler.weight_class : null
  const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null
  const onWeight = rawCut !== null && rawCut <= 0

  const chartData = (() => {
    const byDate = {}
    for (const log of logs) {
      const d = new Date(log.logged_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!byDate[key]) byDate[key] = { key, date: label, total: 0, count: 0 }
      byDate[key].total += log.weight
      byDate[key].count++
    }
    return Object.values(byDate)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(d => ({ date: d.date, weight: parseFloat((d.total / d.count).toFixed(1)) }))
  })()

  const recentLogs = [...logs].reverse().slice(0, 10)

  return (
    <View style={s.root}>
      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {wrestler?.weight_class != null && (
          <View style={s.summaryBar}>
            <Text style={s.summaryLabel}>To cut</Text>
            <Text style={[s.summaryValue, onWeight && { color: colors.success }]}>
              {onWeight ? '0.0' : lbsToCut != null ? formatWeight(lbsToCut) : '—'}
              {!onWeight && lbsToCut != null ? <Text style={s.summaryUnit}> lbs</Text> : null}
            </Text>
            <Text style={s.summaryTarget}>Target: {wrestler.weight_class} class</Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.sectionLabel}>Enter weight</Text>
          {currentWeight !== null
            ? <WheelPicker value={currentWeight} onChange={setWeight} />
            : <Text style={s.loadingWheel}>Loading…</Text>
          }

          <Text style={s.sectionLabel}>Time of day</Text>
          <View style={s.todRow}>
            {TIME_OF_DAY.map(o => {
              const active = timeOfDay === o.value
              return (
                <TouchableOpacity
                  key={o.value}
                  onPress={() => setTimeOfDay(o.value)}
                  activeOpacity={0.7}
                  style={[s.todBtn, active ? s.todBtnActive : s.todBtnInactive]}
                >
                  <Ionicons name={o.icon} size={22} color={active ? colors.accent : colors.textTertiary} />
                  <Text style={[s.todBtnText, active ? s.todBtnTextActive : s.todBtnTextInactive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={s.sectionLabel}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={s.noteInput}
            placeholder="Optional note"
            placeholderTextColor={colors.textTertiary}
            multiline={false}
          />

          {submitError ? <Text style={s.errorText}>{submitError}</Text> : null}

          <Button
            label={submitting ? 'Logging…' : 'Log weight'}
            onPress={handleLog}
            disabled={submitting || !timeOfDay || currentWeight === null || !weight}
            loading={submitting}
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {recentLogs.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Recent</Text>
            {recentLogs.map((log, i) => (
              <View key={i} style={[s.recentRow, i < recentLogs.length - 1 && s.recentRowBorder]}>
                <View style={s.recentLeft}>
                  <Text style={s.recentDate}>
                    {new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  {log.note ? <Text style={s.recentNote} numberOfLines={2}>{log.note}</Text> : null}
                </View>
                <Text style={s.recentWeight}>{formatWeight(log.weight)}</Text>
                <Text style={s.recentTod}>{formatTimeOfDay(log.time_of_day)}</Text>
              </View>
            ))}
          </View>
        )}

        {!isLoading && chartData.length > 1 && (
          <WeightChart data={chartData} />
        )}

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: colors.bg },
  content:          { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  summaryBar:       { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, gap: 4 },
  summaryLabel:     { fontSize: 15, color: colors.textSecondary },
  summaryValue:     { fontSize: 48, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'], lineHeight: 52 },
  summaryUnit:      { fontSize: 22, fontWeight: '600', color: colors.textSecondary },
  summaryTarget:    { fontSize: 15, color: colors.textTertiary, marginTop: 4 },
  card:             { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  cardTitle:        { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 4 },
  sectionLabel:     { fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs },
  loadingWheel:     { fontSize: 15, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.md },
  todRow:           { flexDirection: 'row', gap: spacing.sm },
  todBtn:           { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.sm, minHeight: MIN_TOUCH },
  todBtnActive:     { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  todBtnInactive:   { backgroundColor: colors.surfaceElevated, borderColor: colors.separator },
  todBtnText:       { fontSize: 13 },
  todBtnTextActive: { color: colors.accent, fontWeight: '600' },
  todBtnTextInactive:{ color: colors.textTertiary },
  noteInput:        { backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, borderRadius: radii.sm, color: colors.text, fontSize: 17, paddingHorizontal: spacing.md, paddingVertical: 12, minHeight: MIN_TOUCH },
  errorText:        { fontSize: 15, color: colors.error },
  recentRow:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: spacing.sm, gap: spacing.sm },
  recentRowBorder:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  recentLeft:       { flex: 1.2, gap: 2 },
  recentDate:       { fontSize: 15, color: colors.text },
  recentNote:       { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  recentWeight:     { fontSize: 17, fontWeight: '700', color: colors.text, flex: 0.8, textAlign: 'center', fontVariant: ['tabular-nums'] },
  recentTod:        { fontSize: 13, color: colors.textTertiary, flex: 0.8, textAlign: 'right' },
})
