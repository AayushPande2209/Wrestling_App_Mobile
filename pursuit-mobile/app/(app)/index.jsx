import { useState, useEffect } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Polyline, Path } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import Screen from '../../components/ui/Screen'
import ScreenHeader from '../../components/ui/ScreenHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import AppText, { StatText } from '../../components/ui/AppText'
import StatPill from '../../components/ui/StatPill'
import QuickActionChip from '../../components/ui/QuickActionChip'
import { colors, spacing, radii } from '../../constants/theme'

const API_URL = process.env.EXPO_PUBLIC_API_URL
const SW = Dimensions.get('window').width

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
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
  const W = SW - spacing.md * 4
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
    ` L ${pts[n - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`
  return (
    <Svg width={W} height={H}>
      <Path d={areaD} fill={colors.accent} fillOpacity={0.15} />
      <Polyline points={lineStr} fill="none" stroke={colors.accent} strokeWidth={2} strokeOpacity={0.7} />
    </Svg>
  )
}

function coachPhaseLabel(wrestler, nextEvent) {
  if (!wrestler?.weight_class || !wrestler?.current_weight) return null
  const over = wrestler.current_weight - wrestler.weight_class
  if (over <= 0) return { label: 'On weight', color: colors.success, bg: colors.successMuted }
  if (nextEvent) {
    const days = Math.ceil((new Date(nextEvent.starts_at) - new Date()) / 86400000)
    if (days <= 1) return { label: 'Same-day cut', color: colors.warning, bg: 'rgba(255, 214, 10, 0.12)' }
    if (days <= 7) return { label: 'Lead-up phase', color: colors.accent, bg: colors.accentMuted }
  }
  return { label: 'No weigh-in scheduled', color: colors.textSecondary, bg: colors.surfaceElevated }
}

export default function Today() {
  const [wrestler, setWrestler] = useState(null)
  const [allLogs, setAllLogs] = useState([])
  const [heroLogs, setHeroLogs] = useState([])
  const [matches, setMatches] = useState([])
  const [nextEvent, setNextEvent] = useState(null)
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
        { data: allLogsData },
        { data: matchData },
        { data: events },
      ] = await Promise.all([
        supabase.from('wrestlers').select('id, name, email, current_weight, weight_class, show_on_board').eq('id', uid).single(),
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
          supabase.from('matches').select('result, created_at, opponent_name, wrestler_id, wrestlers!inner(name, show_on_board)').neq('wrestler_id', uid).gte('created_at', cutoff48h).eq('wrestlers.show_on_board', true).order('created_at', { ascending: false }).limit(20),
        ])
        const safeName = raw => (!raw || raw.includes('@')) ? 'Wrestler' : raw
        const items = []
        for (const l of feedLogs ?? []) items.push({ name: safeName(l.wrestlers?.name), text: `logged ${l.weight} lbs`, ts: l.logged_at })
        for (const m of feedMatches ?? []) items.push({ name: safeName(m.wrestlers?.name), text: `${m.result === 'win' ? 'won' : m.result === 'loss' ? 'lost' : 'drew'} vs ${m.opponent_name}`, ts: m.created_at })
        items.sort((a, b) => b.ts.localeCompare(a.ts))
        setFeed(items.slice(0, 3))
      } catch { /* silent */ }

      try {
        const res = await fetch(`${API_URL}/predict/performance-trend`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) setPerfTrend(await res.json())
      } catch { /* silent */ }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const displayName = wrestler?.name && wrestler.name !== wrestler?.email
    ? wrestler.name.split(' ')[0]
    : 'Wrestler'

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
  const pct = rawCut !== null ? Math.min(100, Math.max(0, (rawCut / 10) * 100)) : null
  const phase = coachPhaseLabel(wrestler, nextEvent)

  const trendBadge = perfTrend?.trend === 'improving' ? '↑' : perfTrend?.trend === 'declining' ? '↓' : null

  return (
    <Screen scroll loading={loading} error={error} contentStyle={{ paddingTop: spacing.md }}>
      <ScreenHeader
        large
        title={`${greeting()}, ${displayName}`}
        avatarLabel={displayName}
        onAvatarPress={() => router.push('/profile')}
      />

      {wrestler?.weight_class == null ? (
        <Card>
          <View style={styles.promptRow}>
            <Ionicons name="body-outline" size={24} color={colors.accent} />
            <View style={styles.promptText}>
              <AppText variant="headline">Set your weight class</AppText>
              <AppText variant="footnote">Required to track your cut progress.</AppText>
            </View>
          </View>
          <Button label="Go to profile" variant="ghost" onPress={() => router.push('/profile')} />
        </Card>
      ) : (
        <Card elevated style={styles.heroCard}>
          <View style={styles.chartWrap} pointerEvents="none">
            <HeroChart logs={heroLogs} />
          </View>
          <AppText variant="footnote" color={colors.textSecondary}>To cut</AppText>
          <View style={styles.cutRow}>
            <StatText style={{ color: onWeight ? colors.success : colors.accent }}>
              {onWeight ? '0.0' : lbsToCut != null ? lbsToCut.toFixed(1) : '—'}
            </StatText>
            <AppText variant="title2" color={colors.textSecondary}> lbs</AppText>
          </View>
          <AppText variant="footnote" color={colors.textTertiary}>
            Target: {wrestler.weight_class} class
          </AppText>
          {pct !== null && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
            </View>
          )}
          <Button label="Log weight" onPress={() => router.push('/(app)/weight')} style={{ marginTop: spacing.sm }} />
        </Card>
      )}

      <View style={styles.quickRow}>
        <QuickActionChip icon="shield-outline" label="Match" onPress={() => router.push('/(app)/log?tab=MATCHES')} />
        <QuickActionChip icon="barbell-outline" label="Workout" onPress={() => router.push('/(app)/log?tab=WORKOUTS')} />
        <QuickActionChip icon="create-outline" label="Note" onPress={() => router.push('/(app)/log?tab=NOTES')} />
        <QuickActionChip icon="chatbubble-outline" label="Coach" onPress={() => router.push('/(app)/coach')} />
      </View>

      <StatPill items={[
        { label: 'Record', value: `${wins}–${losses}` },
        { label: 'Win rate', value: winRate !== null ? `${winRate}%${trendBadge ?? ''}` : '—', highlight: winRate !== null && winRate >= 60 },
        { label: 'Log streak', value: streak > 0 ? `${streak}d` : '—', highlight: streak >= 3 },
        { label: 'Weigh-in', value: daysUntil !== null ? (daysUntil === 0 ? 'Today' : `${daysUntil}d`) : '—', highlight: daysUntil !== null && daysUntil <= 3 && daysUntil > 0 },
      ]} />

      <Card>
        <AppText variant="headline">Next event</AppText>
        {nextEvent ? (
          <View style={{ marginTop: spacing.sm, gap: 4 }}>
            <AppText variant="body">{nextEvent.title}</AppText>
            <AppText variant="footnote">
              {new Date(nextEvent.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </AppText>
            {nextEvent.location ? (
              <AppText variant="footnote" color={colors.textTertiary}>{nextEvent.location}</AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="footnote" color={colors.textTertiary} style={{ marginTop: spacing.sm }}>
            No upcoming events scheduled.
          </AppText>
        )}
      </Card>

      {phase && (
        <Card onPress={() => router.push('/(app)/coach')}>
          <View style={styles.coachRow}>
            <View style={[styles.phaseBadge, { backgroundColor: phase.bg }]}>
              <AppText variant="caption" color={phase.color}>{phase.label}</AppText>
            </View>
            <AppText variant="body" color={colors.accent}>Ask coach →</AppText>
          </View>
        </Card>
      )}

      <Card onPress={() => router.push('/board')}>
        <View style={styles.teamHeader}>
          <AppText variant="headline">Team pulse</AppText>
          <AppText variant="footnote" color={colors.accent}>View board</AppText>
        </View>
        {feed.length === 0 ? (
          <AppText variant="footnote" color={colors.textTertiary} style={{ marginTop: spacing.sm }}>
            No team activity in the last 48 hours.
          </AppText>
        ) : (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {feed.map((item, i) => (
              <View key={i} style={styles.feedRow}>
                <AppText variant="footnote" color={colors.textTertiary} style={styles.feedTs}>
                  {new Date(item.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </AppText>
                <AppText variant="footnote">
                  <AppText variant="footnote" color={colors.accent}>{item.name}</AppText>
                  {' '}{item.text}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  heroCard: { overflow: 'hidden', paddingBottom: spacing.lg },
  chartWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.9 },
  cutRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.xs },
  progressWrap: { marginTop: spacing.sm },
  progressTrack: { height: 4, backgroundColor: colors.surfaceElevated, borderRadius: radii.full, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: radii.full },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  promptText: { flex: 1, gap: 4 },
  coachRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phaseBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.full },
  teamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedRow: { gap: 2 },
  feedTs: { marginBottom: 2 },
})
