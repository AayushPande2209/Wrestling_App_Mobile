import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Polyline, Path } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL
const SW = Dimensions.get('window').width

const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#222',
  borderAccent: '#2a1a06',
  orange: '#e8712a',
  orangeDim: '#1e1208',
  orangeBorder: '#3a2010',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
  textFaint: '#333333',
  green: '#4ade80',
  greenDim: '#1a2a1a',
  red: '#e24a4a',
}

function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function computeStreak(logs) {
  if (!logs.length) return 0
  const logDates = new Set(logs.map(l => localDateStr(new Date(l.logged_at))))
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  if (!logDates.has(localDateStr(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (logDates.has(localDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function HeroChart({ logs }) {
  const W = SW - 48
  const H = 56
  if (!logs || logs.length < 2) return null
  const weights = logs.map(l => l.weight).filter(Boolean)
  if (weights.length < 2) return null
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1
  const n = weights.length
  const pts = weights.map((w, i) => ({
    x: (i / (n - 1)) * W,
    y: H - ((w - minW) / range) * H * 0.8 + H * 0.1,
  }))
  const lineStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} ` +
    pts.slice(1).map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ` L ${pts[n-1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`
  return (
    <Svg width={W} height={H}>
      <Path d={areaD} fill={C.orange} fillOpacity={0.2} />
      <Polyline points={lineStr} fill="none" stroke={C.orange} strokeWidth={1.5} strokeOpacity={0.6} />
    </Svg>
  )
}

function StatCard({ label, value, highlight, green }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[
        s.statValue,
        highlight && { color: C.orange },
        green && { color: C.green },
      ]}>
        {value}
      </Text>
    </View>
  )
}

export default function Dashboard() {
  const [wrestler, setWrestler] = useState(null)
  const [allLogs, setAllLogs] = useState([])
  const [heroLogs, setHeroLogs] = useState([])
  const [matches, setMatches] = useState([])
  const [nextEvent, setNextEvent] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [perfTrend, setPerfTrend] = useState(null)
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id

      const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

      const [
        { data: wrestlerData },
        { data: logs },
        { data: allLogsData },
        { data: matchData },
        { data: events },
      ] = await Promise.all([
        supabase.from('wrestlers').select('id, name, email, current_weight, weight_class, show_on_board').eq('id', uid).single(),
        supabase.from('weight_logs').select('weight, logged_at').eq('wrestler_id', uid).order('logged_at', { ascending: false }).limit(1),
        supabase.from('weight_logs').select('weight, logged_at').eq('wrestler_id', uid).order('logged_at', { ascending: false }).limit(90),
        supabase.from('matches').select('result').eq('wrestler_id', uid),
        supabase.from('schedules').select('id, title, starts_at, location').eq('wrestler_id', uid).gt('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1),
      ])

      setWrestler(wrestlerData)
      setAllLogs(allLogsData ?? [])
      setHeroLogs(allLogsData ? [...allLogsData].slice(0, 7).reverse() : [])
      setMatches(matchData ?? [])
      setNextEvent(events?.[0] ?? null)

      try {
        const [{ data: feedLogs }, { data: feedMatches }] = await Promise.all([
          supabase.from('weight_logs').select('weight, logged_at, wrestler_id, wrestlers!inner(name, show_on_board)').neq('wrestler_id', uid).gte('logged_at', cutoff48h).eq('wrestlers.show_on_board', true).order('logged_at', { ascending: false }).limit(20),
          supabase.from('matches').select('result, match_date, created_at, opponent_name, wrestler_id, wrestlers!inner(name, show_on_board)').neq('wrestler_id', uid).gte('created_at', cutoff48h).eq('wrestlers.show_on_board', true).order('created_at', { ascending: false }).limit(20),
        ])
        const safeName = raw => (!raw || raw.includes('@')) ? 'Wrestler' : raw
        const items = []
        for (const l of feedLogs ?? []) items.push({ name: safeName(l.wrestlers?.name), text: `logged ${l.weight} lbs`, ts: l.logged_at })
        for (const m of feedMatches ?? []) items.push({ name: safeName(m.wrestlers?.name), text: `${m.result === 'win' ? 'won' : m.result === 'loss' ? 'lost' : 'drew'} vs ${m.opponent_name}`, ts: m.created_at })
        items.sort((a, b) => b.ts.localeCompare(a.ts))
        setFeed(items.slice(0, 10))
      } catch { /* feed fails silently */ }

      if (wrestlerData?.weight_class && logs?.[0] && events?.[0]) {
        try {
          const daysUntil = Math.max(1, Math.ceil((new Date(events[0].starts_at) - new Date()) / 86400000))
          const res = await fetch(`${API_URL}/predict/weight-cut`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ current_weight: logs[0].weight, target_weight_class: wrestlerData.weight_class, days_until_weigh_in: daysUntil }),
          })
          if (res.ok) setPrediction(await res.json())
        } catch { /* fail silently */ }
      }

      try {
        const res = await fetch(`${API_URL}/predict/performance-trend`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) setPerfTrend(await res.json())
      } catch { /* fail silently */ }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <View style={s.center}><Text style={s.loading}>LOADING...</Text></View>
  }
  if (error) {
    return <View style={s.center}><Text style={s.errorText}>{error}</Text></View>
  }

  const displayName = wrestler?.name && wrestler.name !== wrestler?.email ? wrestler.name.toUpperCase() : 'WRESTLER'
  const wins = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : null
  const streak = computeStreak(allLogs)

  const daysUntil = nextEvent
    ? Math.max(0, Math.ceil((new Date(nextEvent.starts_at) - new Date()) / 86400000))
    : null

  const rawCut = wrestler?.current_weight != null && wrestler?.weight_class != null
    ? wrestler.current_weight - wrestler.weight_class : null
  const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null
  const onWeight = rawCut !== null && rawCut <= 0
  const pct = rawCut !== null
    ? Math.min(100, Math.max(0, (rawCut / 10) * 100))
    : null

  const trendColor =
    perfTrend?.trend === 'improving' ? C.green :
    perfTrend?.trend === 'declining' ? C.red : C.textMuted

  const trendBg =
    perfTrend?.trend === 'improving' ? C.greenDim :
    perfTrend?.trend === 'declining' ? 'rgba(226,74,74,0.12)' : '#1a1a1a'

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>PURSUIT</Text>
          <Text style={s.headerSub}>{displayName}</Text>
        </View>
        <Ionicons name="notifications-outline" size={20} color={C.textDim} />
      </View>

      {/* Hero card — prompt if weight class not set */}
      {wrestler?.weight_class == null ? (
        <View style={s.promptCard}>
          <Ionicons name="body-outline" size={22} color={C.orange} />
          <Text style={s.promptTitle}>SET YOUR WEIGHT CLASS</Text>
          <Text style={s.promptBody}>Set your weight class in Profile to see your cut analysis.</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/profile')} activeOpacity={0.7} style={s.promptBtn}>
            <Text style={s.promptBtnText}>GO TO PROFILE →</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Hero card */}
      {wrestler?.weight_class != null && <View style={s.heroCard}>
        {/* Chart overlay at bottom */}
        <View style={s.chartAbs} pointerEvents="none">
          <HeroChart logs={heroLogs} />
        </View>

        <Text style={s.toCutLabel}>TO CUT</Text>
        <View style={s.toCutRow}>
          <Text style={[s.toCutValue, onWeight && { color: C.green }]}>
            {onWeight ? '0.0' : lbsToCut != null ? lbsToCut.toFixed(1) : '—'}
          </Text>
          <Text style={s.toCutUnit}> LBS</Text>
        </View>
        <Text style={s.toCutSub}>
          LBS TO {wrestler?.weight_class ?? '—'} CLASS
        </Text>

        {pct !== null && (
          <>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${pct}%` }]} />
            </View>
            <View style={s.progressLabels}>
              <Text style={s.progressLabelText}>{wrestler.weight_class}</Text>
              <Text style={s.progressLabelText}>{wrestler.current_weight}</Text>
              <Text style={s.progressLabelText}>+5</Text>
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={() => router.push('/(app)/weight')}
          activeOpacity={0.7}
          style={s.logWeightBtn}
        >
          <Text style={s.logWeightBtnText}>LOG WEIGHT</Text>
        </TouchableOpacity>
      </View>}

      {/* Quick actions */}
      <View style={s.quickRow}>
        <TouchableOpacity onPress={() => router.push('/(app)/logs?tab=MATCHES')} activeOpacity={0.7} style={s.quickBtn}>
          <Ionicons name="add-circle-outline" size={15} color={C.orange} />
          <Text style={s.quickBtnText}>ADD MATCH</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(app)/logs?tab=NOTES')} activeOpacity={0.7} style={s.quickBtn}>
          <Ionicons name="create-outline" size={15} color={C.orange} />
          <Text style={s.quickBtnText}>ADD NOTE</Text>
        </TouchableOpacity>
      </View>

      {/* 2×2 stat grid */}
      <View style={s.statGrid}>
        <StatCard label="RECORD" value={`${wins}—${losses}`} />
        <StatCard label="STREAK" value={streak > 0 ? `${streak}D` : '—'} highlight={streak >= 3} />
        <StatCard label="WIN RATE" value={winRate !== null ? `${winRate}%` : '—'} highlight={winRate !== null && winRate >= 60} />
        <StatCard
          label="WEIGH-IN"
          value={daysUntil !== null ? (daysUntil === 0 ? 'TODAY' : `${daysUntil}D`) : '—'}
          highlight={daysUntil !== null && daysUntil <= 3 && daysUntil > 0}
        />
      </View>

      {/* Performance trend */}
      {perfTrend && (
        <View style={s.card}>
          <Text style={s.cardTitle}>PERFORMANCE TREND</Text>
          <View style={s.trendRow}>
            <View style={s.trendStat}>
              <Text style={s.microLabel}>OVERALL</Text>
              <Text style={s.trendNum}>{(perfTrend.win_rate * 100).toFixed(0)}<Text style={s.trendNumUnit}>%</Text></Text>
            </View>
            <View style={s.trendStat}>
              <Text style={s.microLabel}>RECENT</Text>
              <Text style={s.trendNum}>{(perfTrend.recent_win_rate * 100).toFixed(0)}<Text style={s.trendNumUnit}>%</Text></Text>
            </View>
            <View style={[s.trendBadge, { backgroundColor: trendBg }]}>
              <Text style={[s.trendBadgeText, { color: trendColor }]}>
                {perfTrend.trend.toUpperCase()}
              </Text>
            </View>
          </View>
          {perfTrend.insight ? (
            <Text style={s.trendInsight}>{perfTrend.insight}</Text>
          ) : null}
        </View>
      )}

      {/* Cut analysis */}
      {prediction && (
        <View style={s.card}>
          <Text style={s.cardTitle}>CUT ANALYSIS</Text>
          <Text style={s.bodyText}>{prediction.recommendation}</Text>
          <View style={s.cutRow}>
            <View>
              <Text style={s.microLabel}>DAILY RATE</Text>
              <Text style={s.medNum}>{prediction.daily_cut_rate} <Text style={s.unit}>LBS/DAY</Text></Text>
            </View>
            <View>
              <Text style={s.microLabel}>STATUS</Text>
              <Text style={[s.statusText, { color: prediction.is_safe ? C.green : C.orange }]}>
                {prediction.is_safe ? 'SAFE' : 'AGGRESSIVE'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Next event */}
      <View style={s.card}>
        <Text style={s.cardTitle}>NEXT EVENT</Text>
        {nextEvent ? (
          <>
            <Text style={s.eventTitle}>{nextEvent.title}</Text>
            <Text style={s.eventDate}>
              {new Date(nextEvent.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
            </Text>
            {nextEvent.location ? <Text style={s.eventDate}>{nextEvent.location.toUpperCase()}</Text> : null}
          </>
        ) : (
          <Text style={s.emptyText}>No upcoming events scheduled.</Text>
        )}
      </View>

      {/* Team feed */}
      {feed.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>TEAM ACTIVITY — LAST 48H</Text>
          {feed.map((item, i) => (
            <View key={i} style={s.feedRow}>
              <Text style={s.feedTs}>
                {new Date(item.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={s.feedName}>{item.name}</Text>
              <Text style={s.feedText}> {item.text}</Text>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: C.bg },
  content:          { padding: 16, paddingBottom: 24, gap: 12 },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loading:          { fontSize: 11, color: C.textMuted, letterSpacing: 6, fontFamily: 'monospace' },
  errorText:        { fontSize: 12, color: C.red, fontFamily: 'monospace' },

  // Header
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  headerTitle:      { fontSize: 13, fontWeight: 'bold', letterSpacing: 6, color: C.orange, fontFamily: 'monospace' },
  headerSub:        { fontSize: 9, color: C.textMuted, letterSpacing: 2, marginTop: 2, fontFamily: 'monospace' },

  // Prompt card (weight class not set)
  promptCard:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.orangeBorder, borderRadius: 10, padding: 20, alignItems: 'center', gap: 8 },
  promptTitle:      { fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: C.orange, fontFamily: 'monospace' },
  promptBody:       { fontSize: 11, color: C.textMuted, fontFamily: 'monospace', textAlign: 'center', lineHeight: 16 },
  promptBtn:        { marginTop: 4, backgroundColor: C.orangeDim, borderWidth: 1, borderColor: C.orangeBorder, borderRadius: 6, paddingVertical: 9, paddingHorizontal: 20 },
  promptBtnText:    { fontSize: 10, letterSpacing: 3, color: C.orange, fontFamily: 'monospace', fontWeight: 'bold' },

  // Quick actions
  quickRow:         { flexDirection: 'row', gap: 8 },
  quickBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingVertical: 10 },
  quickBtnText:     { fontSize: 9, letterSpacing: 3, color: C.orange, fontFamily: 'monospace', fontWeight: '500' },

  // Hero card
  heroCard:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderAccent, borderRadius: 10, padding: 16, paddingBottom: 76, overflow: 'hidden', position: 'relative' },
  chartAbs:         { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16 },
  toCutLabel:       { fontSize: 9, letterSpacing: 4, color: C.textMuted, fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 },
  toCutRow:         { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  toCutValue:       { fontSize: 28, fontWeight: 'bold', color: C.orange, fontFamily: 'monospace', lineHeight: 32 },
  toCutUnit:        { fontSize: 11, color: C.textMuted, fontFamily: 'monospace', marginBottom: 3 },
  toCutSub:         { fontSize: 9, color: C.textDim, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 12 },
  progressTrack:    { height: 4, backgroundColor: '#1e1e1e', borderRadius: 2, marginBottom: 6, overflow: 'hidden' },
  progressFill:     { height: 4, backgroundColor: C.orange, borderRadius: 2 },
  progressLabels:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  progressLabelText:{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' },
  logWeightBtn:     { backgroundColor: C.orange, borderRadius: 6, paddingVertical: 11, alignItems: 'center' },
  logWeightBtnText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: C.bg, fontFamily: 'monospace' },

  // Stat grid
  statGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard:         { flex: 1, minWidth: '44%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 14 },
  statLabel:        { fontSize: 9, letterSpacing: 3, color: C.textMuted, fontFamily: 'monospace', marginBottom: 8, textTransform: 'uppercase' },
  statValue:        { fontSize: 22, fontWeight: 'bold', color: C.text, fontFamily: 'monospace' },

  // Cards
  card:             { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 14 },
  cardTitle:        { fontSize: 9, letterSpacing: 4, color: C.orange, fontFamily: 'monospace', marginBottom: 12, textTransform: 'uppercase' },

  // Trend
  trendRow:         { flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 8 },
  trendStat:        {},
  microLabel:       { fontSize: 9, letterSpacing: 3, color: C.textMuted, fontFamily: 'monospace', marginBottom: 4 },
  trendNum:         { fontSize: 22, color: C.text, fontFamily: 'monospace', fontWeight: 'bold' },
  trendNumUnit:     { fontSize: 11, color: C.textMuted, fontFamily: 'monospace' },
  trendBadge:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, marginLeft: 'auto' },
  trendBadgeText:   { fontSize: 10, fontWeight: 'bold', letterSpacing: 3, fontFamily: 'monospace' },
  trendInsight:     { fontSize: 11, color: '#ccc', fontFamily: 'monospace', lineHeight: 17, marginTop: 4 },

  // Cut analysis
  cutRow:           { flexDirection: 'row', gap: 24, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  bodyText:         { fontSize: 11, color: '#ccc', fontFamily: 'monospace', lineHeight: 17 },
  medNum:           { fontSize: 18, color: C.text, fontFamily: 'monospace', marginTop: 4 },
  unit:             { fontSize: 10, color: C.textMuted, fontFamily: 'monospace' },
  statusText:       { fontSize: 11, fontWeight: 'bold', letterSpacing: 3, fontFamily: 'monospace', marginTop: 4 },

  // Event
  eventTitle:       { fontSize: 14, fontWeight: '600', color: C.text, letterSpacing: 2, fontFamily: 'monospace' },
  eventDate:        { fontSize: 10, color: C.textMuted, marginTop: 5, fontFamily: 'monospace' },
  emptyText:        { fontSize: 11, color: C.textFaint, fontFamily: 'monospace' },

  // Feed
  feedRow:          { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 5 },
  feedTs:           { fontSize: 10, color: C.textFaint, fontFamily: 'monospace', marginRight: 6 },
  feedName:         { fontSize: 10, color: C.orange, fontFamily: 'monospace' },
  feedText:         { fontSize: 10, color: C.textMuted, fontFamily: 'monospace' },
})
