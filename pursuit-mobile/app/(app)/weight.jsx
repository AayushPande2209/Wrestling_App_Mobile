import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Dimensions,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg'
import { supabase } from '../../lib/supabase'

const SCREEN_WIDTH = Dimensions.get('window').width

function WeightChart({ data }) {
  const W = SCREEN_WIDTH - 64
  const H = 160
  const PAD = { top: 10, right: 10, bottom: 24, left: 38 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const weights = data.map(d => d.weight)
  const minW = Math.min(...weights) - 0.5
  const maxW = Math.max(...weights) + 0.5
  const range = maxW - minW || 1

  const toX = i => PAD.left + (i / (data.length - 1)) * innerW
  const toY = w => PAD.top + (1 - (w - minW) / range) * innerH

  const points = data.map((d, i) => `${toX(i)},${toY(d.weight)}`).join(' ')

  const labelEvery = Math.ceil(data.length / 5)
  const yTicks = [minW + range * 0.25, minW + range * 0.5, minW + range * 0.75]

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>DAILY AVERAGE — LAST {data.length} DAYS</Text>
      <Svg width={W} height={H}>
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <Line key={i} x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)} stroke="#1a1a1a" strokeDasharray="2,4" />
        ))}
        {/* Y labels */}
        {yTicks.map((v, i) => (
          <SvgText key={i} x={PAD.left - 4} y={toY(v) + 4} fontSize="9" fill="#555" textAnchor="end" fontFamily="monospace">{v.toFixed(0)}</SvgText>
        ))}
        {/* Line */}
        <Polyline points={points} fill="none" stroke="#d97706" strokeWidth="2" />
        {/* Dots */}
        {data.map((d, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(d.weight)} r="3" fill="#d97706" />
        ))}
        {/* X labels */}
        {data.filter((_, i) => i % labelEvery === 0).map((d, idx) => {
          const origIdx = idx * labelEvery
          return (
            <SvgText key={origIdx} x={toX(origIdx)} y={H - 4} fontSize="9" fill="#555" textAnchor="middle" fontFamily="monospace">{d.date}</SvgText>
          )
        })}
      </Svg>
    </View>
  )
}

const API_URL = process.env.EXPO_PUBLIC_API_URL

const TIME_OF_DAY_OPTIONS = [
  { value: 'morning', label: 'MORNING' },
  { value: 'before_practice', label: 'BEFORE PRACTICE' },
  { value: 'after_practice', label: 'AFTER PRACTICE' },
  { value: 'night', label: 'NIGHT' },
]

function FieldLabel({ text }) {
  return <Text style={s.fieldLabel}>{text}</Text>
}

export default function WeightLog() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [weight, setWeight] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
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
    setSubmitError(null)
    setSubmitSuccess(false)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      const { error } = await supabase.from('weight_logs').insert({
        wrestler_id: uid,
        weight: parseFloat(weight),
        time_of_day: timeOfDay,
        note: note || null,
        logged_at: new Date().toISOString(),
      })
      if (error) throw error
      await supabase.from('wrestlers').update({ current_weight: parseFloat(weight) }).eq('id', uid)
      setWeight(''); setTimeOfDay(''); setNote('')
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

  // Build chart data (daily averages)
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

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>WEIGHT LOG</Text>

      {/* Log form */}
      <View style={s.card}>
        <Text style={s.cardTitle}>LOG WEIGHT</Text>
        <FieldLabel text="WEIGHT (LBS)" />
        <TextInput value={weight} onChangeText={setWeight} style={s.input} keyboardType="decimal-pad" placeholder="152.4" placeholderTextColor="#2a2a2a" />
        <FieldLabel text="TIME OF DAY" />
        <View style={s.segmented}>
          {TIME_OF_DAY_OPTIONS.map(o => (
            <TouchableOpacity key={o.value} onPress={() => setTimeOfDay(o.value)} style={[s.seg, timeOfDay === o.value && s.segActive]}>
              <Text style={[s.segText, timeOfDay === o.value && s.segTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FieldLabel text="NOTE (OPTIONAL)" />
        <TextInput value={note} onChangeText={setNote} style={s.input} placeholder="felt heavy, post-practice..." placeholderTextColor="#2a2a2a" />
        {submitError && <Text style={s.errorText}>{submitError}</Text>}
        {submitSuccess && <Text style={{ color: '#22c55e', fontSize: 11, fontFamily: 'monospace' }}>Weight logged.</Text>}
        <TouchableOpacity onPress={handleLog} disabled={submitting} style={[s.btn, submitting && s.btnDisabled]}>
          <Text style={s.btnText}>{submitting ? 'LOGGING...' : 'LOG WEIGHT'}</Text>
        </TouchableOpacity>
      </View>

      {/* Cut predictor */}
      <View style={s.card}>
        <Text style={s.cardTitle}>CUT PREDICTOR</Text>
        <FieldLabel text="TARGET CLASS (LBS)" />
        <TextInput value={cutTarget} onChangeText={setCutTarget} style={s.input} keyboardType="numeric" placeholder="152" placeholderTextColor="#2a2a2a" />
        <FieldLabel text="DAYS UNTIL WEIGH-IN" />
        <TextInput value={cutDays} onChangeText={setCutDays} style={s.input} keyboardType="numeric" placeholder="7" placeholderTextColor="#2a2a2a" />
        <TouchableOpacity onPress={handleCutPredict} disabled={cutLoading} style={[s.outlineBtn, cutLoading && s.btnDisabled]}>
          <Text style={s.outlineBtnText}>{cutLoading ? 'ANALYZING...' : 'ANALYZE CUT'}</Text>
        </TouchableOpacity>
        {cutResult && (
          <View style={s.resultBox}>
            <Text style={s.bodyText}>{cutResult.recommendation}</Text>
            <View style={s.row}>
              <View>
                <Text style={s.microLabel}>TO CUT</Text>
                <Text style={s.bigNum}>{cutResult.lbs_to_cut} <Text style={s.unit}>LBS</Text></Text>
              </View>
              <View>
                <Text style={s.microLabel}>RATE</Text>
                <Text style={s.bigNum}>{cutResult.daily_cut_rate} <Text style={s.unit}>LBS/DAY</Text></Text>
              </View>
              <View>
                <Text style={s.microLabel}>STATUS</Text>
                <Text style={[s.statusText, { color: cutResult.is_safe ? '#22c55e' : '#d97706' }]}>
                  {cutResult.is_safe ? 'SAFE' : 'AGGRESSIVE'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Weight trend predictor */}
      <View style={s.card}>
        <Text style={s.cardTitle}>WEIGHT TREND PREDICTOR</Text>
        <FieldLabel text="TARGET DATE (YYYY-MM-DD)" />
        <TextInput value={trendDate} onChangeText={setTrendDate} style={s.input} placeholder="2025-01-15" placeholderTextColor="#2a2a2a" />
        <TouchableOpacity onPress={handleWeightTrend} disabled={trendLoading} style={[s.outlineBtn, trendLoading && s.btnDisabled]}>
          <Text style={s.outlineBtnText}>{trendLoading ? 'PREDICTING...' : 'PREDICT'}</Text>
        </TouchableOpacity>
        {trendResult && (
          <View style={[s.row, { marginTop: 12 }]}>
            <View>
              <Text style={s.microLabel}>PREDICTED WEIGHT</Text>
              <Text style={s.bigNum}>{trendResult.predicted_weight} <Text style={s.unit}>LBS</Text></Text>
            </View>
            <View>
              <Text style={s.microLabel}>CONFIDENCE</Text>
              <Text style={[s.statusText, {
                color: trendResult.confidence === 'high' ? '#22c55e'
                  : trendResult.confidence === 'medium' ? '#d97706' : '#aaa',
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
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: '#f0f0f0', fontFamily: 'monospace' },
  card: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 16, gap: 8 },
  cardTitle: { fontSize: 10, letterSpacing: 4, color: '#d97706', fontFamily: 'monospace', marginBottom: 4 },
  fieldLabel: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginTop: 8 },
  input: { backgroundColor: '#060606', borderWidth: 1, borderColor: '#1e1e1e', color: '#f0f0f0', fontFamily: 'monospace', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  seg: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#1e1e1e' },
  segActive: { borderColor: '#d97706' },
  segText: { fontSize: 9, letterSpacing: 3, color: '#888', fontFamily: 'monospace' },
  segTextActive: { color: '#d97706' },
  errorText: { fontSize: 11, color: '#f87171', fontFamily: 'monospace' },
  btn: { backgroundColor: '#d97706', paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 10, letterSpacing: 6, color: '#0a0a0a', fontWeight: 'bold', fontFamily: 'monospace' },
  outlineBtn: { borderWidth: 1, borderColor: '#d97706', paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  outlineBtnText: { fontSize: 10, letterSpacing: 6, color: '#d97706', fontWeight: 'bold', fontFamily: 'monospace' },
  resultBox: { borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 12, marginTop: 8, gap: 8 },
  bodyText: { fontSize: 12, color: '#ccc', fontFamily: 'monospace', lineHeight: 18 },
  row: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  microLabel: { fontSize: 10, letterSpacing: 3, color: '#aaa', fontFamily: 'monospace', marginBottom: 4 },
  bigNum: { fontSize: 20, color: '#f0f0f0', fontFamily: 'monospace' },
  unit: { fontSize: 11, color: '#aaa', fontFamily: 'monospace' },
  statusText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 3, fontFamily: 'monospace', marginTop: 4 },
})
