import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Polyline, Circle, Line, Text as SvgText, Rect, G } from 'react-native-svg'
import { supabase } from '../../lib/supabase'
import WheelPicker from '../../components/WheelPicker'

const SCREEN_WIDTH = Dimensions.get('window').width
const API_URL = process.env.EXPO_PUBLIC_API_URL

const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#222',
  orange: '#e8712a',
  orangeDim: '#1e1208',
  orangeBorder: '#3a2010',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
}

const TIME_OF_DAY = [
  { value: 'morning',         label: 'MORNING' },
  { value: 'before_practice', label: 'PRE-PRACTICE' },
  { value: 'after_practice',  label: 'POST-PRACTICE' },
  { value: 'night',           label: 'NIGHT' },
]

function WeightChart({ data }) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const W = SCREEN_WIDTH - 64
  const H = 180
  const PAD = { top: 44, right: 10, bottom: 24, left: 38 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const weights = data.map(d => d.weight)
  const minW = Math.min(...weights) - 0.5
  const maxW = Math.max(...weights) + 0.5
  const range = maxW - minW || 1

  const toX = i => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW
  const toY = w => PAD.top + (1 - (w - minW) / range) * innerH

  const points = data.map((d, i) => `${toX(i)},${toY(d.weight)}`).join(' ')
  const labelEvery = Math.ceil(data.length / 5)
  const yTicks = [minW + range * 0.25, minW + range * 0.5, minW + range * 0.75]

  const TIP_W = 76
  const TIP_H = 36

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>DAILY AVERAGE — LAST {data.length} DAYS</Text>
      <Svg width={W} height={H}>
        {yTicks.map((v, i) => (
          <Line key={i} x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)} stroke="#1a1a1a" strokeDasharray="2,4" />
        ))}
        {yTicks.map((v, i) => (
          <SvgText key={i} x={PAD.left - 4} y={toY(v) + 4} fontSize="9" fill="#555" textAnchor="end" fontFamily="monospace">{v.toFixed(0)}</SvgText>
        ))}
        <Polyline points={points} fill="none" stroke={C.orange} strokeWidth="2" />
        {data.map((d, i) => (
          <G key={i}>
            <Circle cx={toX(i)} cy={toY(d.weight)} r={selectedIdx === i ? 5 : 3} fill={selectedIdx === i ? '#fff' : C.orange} />
            <Circle cx={toX(i)} cy={toY(d.weight)} r="16" fill="transparent"
              onPress={() => setSelectedIdx(selectedIdx === i ? null : i)} />
          </G>
        ))}
        {data.filter((_, i) => i % labelEvery === 0).map((d, idx) => {
          const origIdx = idx * labelEvery
          return (
            <SvgText key={origIdx} x={toX(origIdx)} y={H - 4} fontSize="9" fill="#555" textAnchor="middle" fontFamily="monospace">{d.date}</SvgText>
          )
        })}
        {selectedIdx !== null && (() => {
          const cx = toX(selectedIdx)
          const cy = toY(data[selectedIdx].weight)
          const tx = Math.min(Math.max(cx - TIP_W / 2, PAD.left), W - PAD.right - TIP_W)
          const ty = cy - TIP_H - 10
          return (
            <G>
              <Rect x={tx} y={ty} width={TIP_W} height={TIP_H} rx="4" fill="#1e1208" stroke={C.orange} strokeWidth="1" />
              <SvgText x={tx + TIP_W / 2} y={ty + 14} fontSize="12" fill={C.orange} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                {data[selectedIdx].weight} LBS
              </SvgText>
              <SvgText x={tx + TIP_W / 2} y={ty + 27} fontSize="9" fill="#888" textAnchor="middle" fontFamily="monospace">
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
  const router = useRouter()
  const [uid, setUid] = useState(null)
  const [weight, setWeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState(null)
  const [timeOfDay, setTimeOfDay] = useState('morning')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const [cutTarget, setCutTarget] = useState('')
  const [cutDays, setCutDays] = useState('')
  const [cutResult, setCutResult] = useState(null)
  const [cutLoading, setCutLoading] = useState(false)

  const [trendDate, setTrendDate] = useState('')
  const [trendResult, setTrendResult] = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setUid(session.user.id)
      const { data } = await supabase.from('wrestlers')
        .select('current_weight')
        .eq('id', session.user.id)
        .single()
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
    setSubmitSuccess(false)
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
      setTimeOfDay('morning'); setNote('')
      setSubmitSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['weight-logs', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCutPredict() {
    if (!cutTarget || !cutDays) return
    setCutResult(null)
    setCutLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const currentWeight = logs.length > 0 ? logs[logs.length - 1].weight : parseFloat(weight)
      const res = await fetch(`${API_URL}/predict/weight-cut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ current_weight: currentWeight, target_weight_class: parseInt(cutTarget), days_until_weigh_in: parseInt(cutDays) }),
      })
      if (res.ok) setCutResult(await res.json())
    } catch { /* fail silently */ }
    finally { setCutLoading(false) }
  }

  async function handleWeightTrend() {
    if (!trendDate) return
    setTrendResult(null)
    setTrendLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${API_URL}/predict/weight-trend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ target_date: trendDate }),
      })
      if (res.ok) setTrendResult(await res.json())
    } catch { /* fail silently */ }
    finally { setTrendLoading(false) }
  }

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

  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const dateStr = `${dayName} · ${month} ${now.getDate()}`

  const recentLogs = [...logs].reverse().slice(0, 10)

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.orange} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>LOG WEIGHT</Text>
        <Text style={s.headerDate}>{dateStr}</Text>
      </View>

      {/* Log form */}
      <View style={s.card}>
        <Text style={s.sectionLabel}>ENTER WEIGHT</Text>
        {currentWeight !== null
          ? <WheelPicker value={currentWeight} onChange={setWeight} />
          : <Text style={s.loadingWheel}>LOADING...</Text>
        }

        <Text style={s.sectionLabel}>TIME OF DAY</Text>
        <View style={s.todGrid}>
          <View style={s.todRow}>
            {TIME_OF_DAY.slice(0, 2).map(o => (
              <TouchableOpacity
                key={o.value}
                onPress={() => setTimeOfDay(o.value)}
                activeOpacity={0.7}
                style={[s.todBtn, timeOfDay === o.value ? s.todBtnActive : s.todBtnInactive]}
              >
                <Text style={[s.todBtnText, timeOfDay === o.value ? s.todBtnTextActive : s.todBtnTextInactive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.todRow}>
            {TIME_OF_DAY.slice(2, 4).map(o => (
              <TouchableOpacity
                key={o.value}
                onPress={() => setTimeOfDay(o.value)}
                activeOpacity={0.7}
                style={[s.todBtn, timeOfDay === o.value ? s.todBtnActive : s.todBtnInactive]}
              >
                <Text style={[s.todBtnText, timeOfDay === o.value ? s.todBtnTextActive : s.todBtnTextInactive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={s.sectionLabel}>NOTE</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          style={s.noteInput}
          placeholder="felt heavy, post-practice..."
          placeholderTextColor="#333"
          multiline={false}
        />

        {submitError ? <Text style={s.errorText}>{submitError}</Text> : null}
        {submitSuccess ? <Text style={s.successText}>Weight logged.</Text> : null}

        <TouchableOpacity
          onPress={handleLog}
          disabled={submitting || !timeOfDay || currentWeight === null}
          activeOpacity={0.7}
          style={[s.logBtn, (submitting || !weight || !timeOfDay) && s.logBtnDisabled]}
        >
          <Text style={s.logBtnText}>{submitting ? 'LOGGING...' : 'LOG WEIGHT'}</Text>
        </TouchableOpacity>
      </View>

      {/* Recent logs */}
      {recentLogs.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>RECENT</Text>
          {recentLogs.map((log, i) => (
            <View key={i} style={[s.recentRow, i < recentLogs.length - 1 && s.recentRowBorder]}>
              <Text style={s.recentDate}>
                {new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
              </Text>
              <Text style={s.recentWeight}>{log.weight}</Text>
              <Text style={s.recentTod}>
                {log.time_of_day ? log.time_of_day.replace(/_/g, ' ').toUpperCase() : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Cut predictor */}
      <View style={s.card}>
        <Text style={s.cardTitle}>CUT PREDICTOR</Text>
        <Text style={s.sectionLabel}>TARGET CLASS (LBS)</Text>
        <TextInput value={cutTarget} onChangeText={setCutTarget} style={s.input} keyboardType="numeric" placeholder="152" placeholderTextColor="#333" />
        <Text style={s.sectionLabel}>DAYS UNTIL WEIGH-IN</Text>
        <TextInput value={cutDays} onChangeText={setCutDays} style={s.input} keyboardType="numeric" placeholder="7" placeholderTextColor="#333" />
        <TouchableOpacity
          onPress={handleCutPredict}
          disabled={cutLoading}
          activeOpacity={0.7}
          style={[s.outlineBtn, cutLoading && s.logBtnDisabled]}
        >
          <Text style={s.outlineBtnText}>{cutLoading ? 'ANALYZING...' : 'ANALYZE CUT'}</Text>
        </TouchableOpacity>
        {cutResult && (
          <View style={s.resultBox}>
            <Text style={s.bodyText}>{cutResult.recommendation}</Text>
            <View style={s.cutRow}>
              <View>
                <Text style={s.microLabel}>TO CUT</Text>
                <Text style={s.medNum}>{cutResult.lbs_to_cut} <Text style={s.unit}>LBS</Text></Text>
              </View>
              <View>
                <Text style={s.microLabel}>RATE</Text>
                <Text style={s.medNum}>{cutResult.daily_cut_rate} <Text style={s.unit}>LBS/DAY</Text></Text>
              </View>
              <View>
                <Text style={s.microLabel}>STATUS</Text>
                <Text style={[s.statusText, { color: cutResult.is_safe ? '#4ade80' : C.orange }]}>
                  {cutResult.is_safe ? 'SAFE' : 'AGGRESSIVE'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Trend predictor */}
      <View style={s.card}>
        <Text style={s.cardTitle}>WEIGHT TREND PREDICTOR</Text>
        <Text style={s.sectionLabel}>TARGET DATE (YYYY-MM-DD)</Text>
        <TextInput value={trendDate} onChangeText={setTrendDate} style={s.input} placeholder="2025-01-15" placeholderTextColor="#333" />
        <TouchableOpacity
          onPress={handleWeightTrend}
          disabled={trendLoading}
          activeOpacity={0.7}
          style={[s.outlineBtn, trendLoading && s.logBtnDisabled]}
        >
          <Text style={s.outlineBtnText}>{trendLoading ? 'PREDICTING...' : 'PREDICT'}</Text>
        </TouchableOpacity>
        {trendResult && (
          <View style={s.cutRow}>
            <View>
              <Text style={s.microLabel}>PREDICTED WEIGHT</Text>
              <Text style={s.medNum}>{trendResult.predicted_weight} <Text style={s.unit}>LBS</Text></Text>
            </View>
            <View>
              <Text style={s.microLabel}>CONFIDENCE</Text>
              <Text style={[s.statusText, {
                color: trendResult.confidence === 'high' ? '#4ade80'
                  : trendResult.confidence === 'medium' ? C.orange : C.textMuted,
              }]}>
                {trendResult.confidence.toUpperCase()}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Chart */}
      {!isLoading && chartData.length > 1 && (
        <WeightChart data={chartData} />
      )}

    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: C.bg },
  content:          { padding: 16, paddingBottom: 24, gap: 12 },

  // Header
  header:           { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  backBtn:          { marginRight: 8 },
  headerTitle:      { fontSize: 13, fontWeight: 'bold', letterSpacing: 4, color: C.text, fontFamily: 'monospace', flex: 1 },
  headerDate:       { fontSize: 9, color: C.textMuted, fontFamily: 'monospace', letterSpacing: 1 },

  // Card
  card:             { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 16, gap: 8 },
  cardTitle:        { fontSize: 9, letterSpacing: 4, color: C.orange, fontFamily: 'monospace', marginBottom: 4 },
  sectionLabel:     { fontSize: 9, letterSpacing: 3, color: C.textMuted, fontFamily: 'monospace', textTransform: 'uppercase' },

  // Wheel picker loading placeholder
  loadingWheel:     { fontSize: 11, color: C.textDim, fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center', paddingVertical: 16 },

  // Time of day
  todGrid:          { gap: 8 },
  todRow:           { flexDirection: 'row', gap: 8 },
  todBtn:           { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderRadius: 4 },
  todBtnActive:     { backgroundColor: C.orangeDim, borderColor: C.orange },
  todBtnInactive:   { backgroundColor: C.surface, borderColor: C.border },
  todBtnText:       { fontSize: 9, fontFamily: 'monospace', letterSpacing: 1.5 },
  todBtnTextActive: { color: C.orange },
  todBtnTextInactive:{ color: C.textDim },

  // Note
  noteInput:        { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 4, color: C.text, fontFamily: 'monospace', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },

  // Feedback
  errorText:        { fontSize: 11, color: '#f87171', fontFamily: 'monospace' },
  successText:      { fontSize: 11, color: '#4ade80', fontFamily: 'monospace' },

  // Log button
  logBtn:           { backgroundColor: C.orange, borderRadius: 6, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  logBtnDisabled:   { opacity: 0.4 },
  logBtnText:       { fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: C.bg, fontFamily: 'monospace' },

  // Recent logs
  recentRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  recentRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  recentDate:       { fontSize: 9, color: C.textMuted, fontFamily: 'monospace', flex: 1 },
  recentWeight:     { fontSize: 13, fontWeight: 'bold', color: C.text, fontFamily: 'monospace', flex: 1, textAlign: 'center' },
  recentTod:        { fontSize: 9, color: C.textDim, fontFamily: 'monospace', flex: 1, textAlign: 'right' },

  // Predictor
  input:            { backgroundColor: C.bg, borderWidth: 1, borderColor: '#1e1e1e', color: C.text, fontFamily: 'monospace', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  outlineBtn:       { borderWidth: 1, borderColor: C.orange, borderRadius: 4, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  outlineBtnText:   { fontSize: 10, letterSpacing: 4, color: C.orange, fontWeight: 'bold', fontFamily: 'monospace' },
  resultBox:        { borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 12, gap: 8 },
  bodyText:         { fontSize: 11, color: '#ccc', fontFamily: 'monospace', lineHeight: 17 },
  cutRow:           { flexDirection: 'row', gap: 24, flexWrap: 'wrap', marginTop: 8 },
  microLabel:       { fontSize: 9, letterSpacing: 3, color: C.textMuted, fontFamily: 'monospace', marginBottom: 4 },
  medNum:           { fontSize: 18, color: C.text, fontFamily: 'monospace' },
  unit:             { fontSize: 10, color: C.textMuted, fontFamily: 'monospace' },
  statusText:       { fontSize: 11, fontWeight: 'bold', letterSpacing: 3, fontFamily: 'monospace', marginTop: 4 },
})
