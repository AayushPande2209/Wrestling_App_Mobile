import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL

const TABS = ['OVERVIEW', 'RECORDS']

function StatBox({ label, value, highlight }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, highlight && s.statValueOrange]}>{value}</Text>
    </View>
  )
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

export default function Dashboard() {
  const [uid, setUid] = useState(null)
  const [wrestler, setWrestler] = useState(null)
  const [allLogs, setAllLogs] = useState([])
  const [matches, setMatches] = useState([])
  const [nextEvent, setNextEvent] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [perfTrend, setPerfTrend] = useState(null)
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('OVERVIEW')
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      setUid(uid)

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
        supabase.from('weight_logs').select('logged_at').eq('wrestler_id', uid).order('logged_at', { ascending: false }).limit(90),
        supabase.from('matches').select('result').eq('wrestler_id', uid),
        supabase.from('schedules').select('id, title, starts_at, location').eq('wrestler_id', uid).gt('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1),
      ])

      setWrestler(wrestlerData)
      setAllLogs(allLogsData ?? [])
      setMatches(matchData ?? [])
      setNextEvent(events?.[0] ?? null)

      try {
        const [{ data: feedLogs }, { data: feedMatches }] = await Promise.all([
          supabase.from('weight_logs').select('weight, logged_at, wrestler_id, wrestlers!inner(name, show_on_board)').neq('wrestler_id', uid).gte('logged_at', cutoff48h).eq('wrestlers.show_on_board', true).order('logged_at', { ascending: false }).limit(20),
          supabase.from('matches').select('result, match_date, created_at, opponent_name, wrestler_id, wrestlers!inner(name, show_on_board)').neq('wrestler_id', uid).gte('created_at', cutoff48h).eq('wrestlers.show_on_board', true).order('created_at', { ascending: false }).limit(20),
        ])
        const safeName = raw => (!raw || raw.includes('@')) ? 'Wrestler' : raw
        const items = []
        for (const l of feedLogs ?? []) {
          items.push({ name: safeName(l.wrestlers?.name), text: `logged ${l.weight} lbs`, ts: l.logged_at })
        }
        for (const m of feedMatches ?? []) {
          items.push({ name: safeName(m.wrestlers?.name), text: `${m.result === 'win' ? 'won' : m.result === 'loss' ? 'lost' : 'drew'} vs ${m.opponent_name}`, ts: m.created_at })
        }
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
    return (
      <View style={s.center}>
        <Text style={s.loading}>LOADING...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
      </View>
    )
  }

  const displayName = wrestler?.name && wrestler.name !== wrestler?.email ? wrestler.name : null
  const wins = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : null
  const streak = computeStreak(allLogs)
  const nextWeighIn = nextEvent
    ? new Date(nextEvent.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
    : null

  const trendColor =
    perfTrend?.trend === 'improving' ? '#22c55e'
    : perfTrend?.trend === 'declining' ? '#f87171'
    : '#aaa'

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.pageTitle}>DASHBOARD</Text>
        {displayName && <Text style={s.nameSub}>{displayName.toUpperCase()}</Text>}
      </View>

      {/* Stat boxes */}
      <View style={s.statsGrid}>
        <StatBox label="RECORD" value={`${wins}—${losses}`} />
        <StatBox label="WIN RATE" value={winRate !== null ? `${winRate}%` : '—'} highlight={winRate !== null && winRate >= 60} />
        <StatBox label="LOG STREAK" value={streak > 0 ? `${streak}D` : '—'} highlight={streak >= 7} />
        <StatBox label="NEXT WEIGH-IN" value={nextWeighIn ?? '—'} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
          >
            <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'OVERVIEW' && (
        <View style={s.section}>
          {/* Performance trend */}
          {perfTrend && (
            <View style={s.card}>
              <Text style={s.cardTitle}>PERFORMANCE TREND</Text>
              <View style={s.row}>
                <View style={s.trendStat}>
                  <Text style={s.microLabel}>OVERALL WIN RATE</Text>
                  <Text style={s.bigNum}>{(perfTrend.win_rate * 100).toFixed(0)}<Text style={s.unit}>%</Text></Text>
                </View>
                <View style={s.trendStat}>
                  <Text style={s.microLabel}>RECENT WIN RATE</Text>
                  <Text style={s.bigNum}>{(perfTrend.recent_win_rate * 100).toFixed(0)}<Text style={s.unit}>%</Text></Text>
                </View>
                <View style={s.trendStat}>
                  <Text style={s.microLabel}>TREND</Text>
                  <Text style={[s.trendValue, { color: trendColor }]}>{perfTrend.trend.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={s.trendInsight}>{perfTrend.insight}</Text>
            </View>
          )}

          {/* Cut analysis */}
          {prediction && (
            <View style={s.card}>
              <Text style={s.cardTitle}>CUT ANALYSIS</Text>
              <Text style={s.bodyText}>{prediction.recommendation}</Text>
              <View style={[s.row, { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1a1a1a' }]}>
                <View>
                  <Text style={s.microLabel}>DAILY RATE</Text>
                  <Text style={s.medNum}>{prediction.daily_cut_rate} <Text style={s.unit}>LBS/DAY</Text></Text>
                </View>
                <View>
                  <Text style={s.microLabel}>STATUS</Text>
                  <Text style={[s.statusText, { color: prediction.is_safe ? '#22c55e' : '#d97706' }]}>
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
                {nextEvent.location && <Text style={s.eventDate}>{nextEvent.location.toUpperCase()}</Text>}
              </>
            ) : (
              <Text style={s.emptyText}>No upcoming events scheduled.</Text>
            )}
          </View>

          {/* Team activity feed */}
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

          {/* Quick actions */}
          <View style={s.quickActions}>
            <Text style={s.quickLabel}>QUICK ACTIONS</Text>
            <View style={s.quickBtns}>
              {[
                { label: 'LOG WEIGHT', href: '/(app)/weight' },
                { label: 'ADD MATCH', href: '/(app)/logs' },
                { label: 'ADD NOTE', href: '/(app)/logs' },
              ].map(({ label, href }) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => router.push(href)}
                  style={s.quickBtn}
                >
                  <Text style={s.quickBtnText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {activeTab === 'RECORDS' && (
        <View style={s.section}>
          <View style={s.card}>
            <Text style={s.cardTitle}>CAREER SUMMARY</Text>
            <View style={s.statsGrid}>
              <StatBox label="W—L" value={`${wins}—${losses}`} />
              <StatBox label="STREAK" value={streak > 0 ? `${streak}D` : '—'} highlight={streak >= 5} />
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' },
  loading: { fontSize: 11, color: '#888', letterSpacing: 6, fontFamily: 'monospace' },
  errorText: { fontSize: 12, color: '#f87171', fontFamily: 'monospace' },
  header: { marginBottom: 16 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: '#f0f0f0', fontFamily: 'monospace' },
  nameSub: { fontSize: 10, color: '#888', letterSpacing: 4, marginTop: 4, fontFamily: 'monospace' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, minWidth: '44%', backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 14 },
  statLabel: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#f0f0f0', fontFamily: 'monospace' },
  statValueOrange: { color: '#e8712a' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a', marginBottom: 16 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#e8712a', marginBottom: -1 },
  tabBtnText: { fontSize: 10, letterSpacing: 5, color: '#555', fontFamily: 'monospace', fontWeight: '500' },
  tabBtnTextActive: { color: '#e8712a' },
  section: { gap: 12 },
  card: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 16 },
  cardTitle: { fontSize: 10, letterSpacing: 4, color: '#d97706', fontFamily: 'monospace', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  trendStat: {},
  microLabel: { fontSize: 10, letterSpacing: 3, color: '#aaa', fontFamily: 'monospace', marginBottom: 4 },
  bigNum: { fontSize: 24, color: '#f0f0f0', fontFamily: 'monospace' },
  unit: { fontSize: 11, color: '#aaa', fontFamily: 'monospace' },
  trendValue: { fontSize: 13, fontWeight: 'bold', letterSpacing: 4, fontFamily: 'monospace', marginTop: 4 },
  trendInsight: { fontSize: 12, color: '#ccc', fontFamily: 'monospace', lineHeight: 18, marginTop: 8 },
  bodyText: { fontSize: 12, color: '#ccc', fontFamily: 'monospace', lineHeight: 18 },
  medNum: { fontSize: 20, color: '#f0f0f0', fontFamily: 'monospace', marginTop: 4 },
  statusText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 3, fontFamily: 'monospace', marginTop: 4 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#f0f0f0', letterSpacing: 2, fontFamily: 'monospace' },
  eventDate: { fontSize: 11, color: '#aaa', marginTop: 6, fontFamily: 'monospace' },
  emptyText: { fontSize: 11, color: '#333', fontFamily: 'monospace' },
  feedRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  feedTs: { fontSize: 10, color: '#333', fontFamily: 'monospace', marginRight: 8 },
  feedName: { fontSize: 10, color: '#e8712a', fontFamily: 'monospace' },
  feedText: { fontSize: 10, color: '#aaa', fontFamily: 'monospace' },
  quickActions: { marginTop: 8 },
  quickLabel: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginBottom: 10 },
  quickBtns: { gap: 8 },
  quickBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  quickBtnText: { fontSize: 10, letterSpacing: 5, color: '#888', fontFamily: 'monospace' },
})
