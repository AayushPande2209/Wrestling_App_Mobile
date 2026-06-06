import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function RecordCard({ label, value, sub }) {
  return (
    <View style={s.recordCard}>
      <Text style={s.recordLabel}>{label}</Text>
      {value !== null ? (
        <>
          <Text style={s.recordValue}>{value}</Text>
          {sub && <Text style={s.recordSub}>{sub}</Text>}
        </>
      ) : (
        <Text style={s.recordDash}>—</Text>
      )}
    </View>
  )
}

function computeRecords(matches) {
  if (!matches.length) return { mostRecentPin: null, biggestDiff: null, longestStreak: null, bestTournament: null }

  const pins = matches.filter(m => m.win_type === 'pin')
  const mostRecentPin = pins.length > 0
    ? { opponent: pins[0].opponent_name, date: pins[0].match_date, tournament: pins[0].tournaments?.name ?? pins[0].tournament }
    : null

  let biggestDiff = null
  for (const m of matches) {
    if (!m.score) continue
    const parts = m.score.split('-').map(p => parseInt(p.trim(), 10))
    if (parts.length === 2 && !parts.some(isNaN)) {
      const diff = Math.abs(parts[0] - parts[1])
      if (!biggestDiff || diff > biggestDiff.diff) {
        biggestDiff = { diff, score: m.score, opponent: m.opponent_name }
      }
    }
  }

  const sorted = [...matches].sort((a, b) => a.match_date.localeCompare(b.match_date))
  let best = 0, current = 0, bestEnd = null
  for (const m of sorted) {
    if (m.result === 'win') {
      current++
      if (current > best) { best = current; bestEnd = m.match_date }
    } else {
      current = 0
    }
  }
  const longestStreak = best > 0 ? { wins: best, endDate: bestEnd } : null

  const byTournament = {}
  for (const m of matches) {
    const tName = m.tournaments?.name ?? m.tournament
    if (!tName) continue
    if (!byTournament[tName]) byTournament[tName] = { wins: 0, losses: 0 }
    if (m.result === 'win') byTournament[tName].wins++
    else if (m.result === 'loss') byTournament[tName].losses++
  }
  let bestTournament = null
  for (const [name, rec] of Object.entries(byTournament)) {
    if (!bestTournament || rec.wins > bestTournament.wins) {
      bestTournament = { name, ...rec }
    }
  }

  return { mostRecentPin, biggestDiff, longestStreak, bestTournament }
}

export default function Records() {
  const [uid, setUid] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  const { data: matches = [], isLoading, error } = useQuery({
    queryKey: ['matches-all', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('id, match_date, opponent_name, result, score, win_type, tournament, tournaments(name)').eq('wrestler_id', uid).order('match_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  if (isLoading) {
    return <View style={s.center}><Text style={s.loading}>LOADING...</Text></View>
  }

  const { mostRecentPin, biggestDiff, longestStreak, bestTournament } = computeRecords(matches)
  const totalMatches = matches.length
  const wins = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length
  const pins = matches.filter(m => m.win_type === 'pin').length
  const pinRate = wins > 0 ? Math.round((pins / wins) * 100) : null

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>RECORDS</Text>

      {totalMatches === 0 ? (
        <Text style={s.emptyText}>Log matches to start building your records.</Text>
      ) : (
        <>
          <View style={s.grid}>
            <RecordCard
              label="LONGEST WIN STREAK"
              value={longestStreak ? `${longestStreak.wins} IN A ROW` : null}
              sub={longestStreak ? `ended ${new Date(longestStreak.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null}
            />
            <RecordCard
              label="BIGGEST POINT DIFF"
              value={biggestDiff ? `+${biggestDiff.diff} PTS` : null}
              sub={biggestDiff ? `${biggestDiff.score} vs ${biggestDiff.opponent}` : null}
            />
            <RecordCard
              label="MOST RECENT PIN"
              value={mostRecentPin ? 'PIN WIN' : null}
              sub={mostRecentPin ? `vs ${mostRecentPin.opponent}${mostRecentPin.tournament ? ` · ${mostRecentPin.tournament}` : ''}` : null}
            />
            <RecordCard
              label="BEST TOURNAMENT"
              value={bestTournament ? `${bestTournament.wins}W ${bestTournament.losses}L` : null}
              sub={bestTournament ? bestTournament.name : null}
            />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>CAREER SUMMARY</Text>
            <View style={s.statsRow}>
              {[
                { label: 'TOTAL MATCHES', value: totalMatches },
                { label: 'WIN RATE', value: totalMatches > 0 ? `${Math.round((wins / totalMatches) * 100)}%` : '—' },
                { label: 'TOTAL PINS', value: pins },
                { label: 'PIN RATE', value: pinRate !== null ? `${pinRate}%` : '—' },
              ].map(({ label, value }) => (
                <View key={label} style={s.stat}>
                  <Text style={s.microLabel}>{label}</Text>
                  <Text style={s.statValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' },
  loading: { fontSize: 11, color: '#888', letterSpacing: 6, fontFamily: 'monospace' },
  pageTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: '#f0f0f0', fontFamily: 'monospace' },
  emptyText: { fontSize: 11, color: '#333', fontFamily: 'monospace' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recordCard: { flex: 1, minWidth: '44%', backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 14 },
  recordLabel: { fontSize: 10, letterSpacing: 3, color: '#aaa', fontFamily: 'monospace', marginBottom: 8 },
  recordValue: { fontSize: 18, fontWeight: 'bold', color: '#f0f0f0', fontFamily: 'monospace' },
  recordSub: { fontSize: 11, color: '#888', fontFamily: 'monospace', marginTop: 4 },
  recordDash: { fontSize: 20, color: '#333', fontFamily: 'monospace' },
  card: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 16 },
  cardTitle: { fontSize: 10, letterSpacing: 4, color: '#d97706', fontFamily: 'monospace', marginBottom: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  stat: {},
  microLabel: { fontSize: 9, letterSpacing: 3, color: '#aaa', fontFamily: 'monospace', marginBottom: 4 },
  statValue: { fontSize: 22, color: '#f0f0f0', fontFamily: 'monospace' },
})
