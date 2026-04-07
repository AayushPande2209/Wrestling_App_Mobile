import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

function RecordCard({ label, value, sub }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5">
      <div className="text-[10px] font-display tracking-[0.15em] text-[#aaa] mb-2">{label}</div>
      {value !== null ? (
        <>
          <div className="font-mono text-2xl font-bold text-[#f0f0f0] tracking-tight">{value}</div>
          {sub && <div className="font-mono text-[11px] text-[#888] mt-1">{sub}</div>}
        </>
      ) : (
        <div className="font-mono text-sm text-[#333]">—</div>
      )}
    </div>
  )
}

function computeRecords(matches) {
  if (!matches.length) return { mostRecentPin: null, biggestDiff: null, longestStreak: null, bestTournament: null }

  // Most recent pin — matches are already ordered descending by match_date,
  // so pins[0] is the most recent. Match duration isn't stored in the schema,
  // so "fastest" is not computable; we surface the most recent instead.
  const pins = matches.filter(m => m.win_type === 'pin')
  const mostRecentPin = pins.length > 0
    ? { opponent: pins[0].opponent_name, date: pins[0].match_date, tournament: pins[0].tournament }
    : null

  // Biggest point differential — parse score "A-B" → |A-B|
  // Tolerates whitespace ("8 - 2") and trailing non-numeric text ("8-2 OT")
  // by trimming each part and parsing only the leading integer.
  let biggestDiff = null
  for (const m of matches) {
    if (!m.score) continue
    const parts = m.score.split('-').map(p => parseInt(p.trim(), 10))
    if (parts.length === 2 && !parts.some(isNaN)) {
      const diff = Math.abs(parts[0] - parts[1])
      if (!biggestDiff || diff > biggestDiff.diff) {
        biggestDiff = { diff, score: m.score, opponent: m.opponent_name, date: m.match_date }
      }
    }
  }

  // Longest win streak — consecutive wins ordered by match_date
  const sorted = [...matches].sort((a, b) => a.match_date.localeCompare(b.match_date))
  let best = 0, current = 0, streakEnd = null, bestEnd = null
  for (const m of sorted) {
    if (m.result === 'win') {
      current++
      streakEnd = m.match_date
      if (current > best) { best = current; bestEnd = streakEnd }
    } else {
      current = 0
    }
  }
  const longestStreak = best > 0 ? { wins: best, endDate: bestEnd } : null

  // Best tournament — most wins at a single named tournament
  const byTournament = {}
  for (const m of matches) {
    if (!m.tournament) continue
    if (!byTournament[m.tournament]) byTournament[m.tournament] = { wins: 0, losses: 0 }
    if (m.result === 'win') byTournament[m.tournament].wins++
    else if (m.result === 'loss') byTournament[m.tournament].losses++
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
      const { data, error } = await supabase
        .from('matches')
        .select('id, match_date, opponent_name, result, score, win_type, tournament')
        .eq('wrestler_id', uid)
        .order('match_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  if (isLoading) return <div className="font-mono text-[#888] text-xs tracking-[0.3em]">LOADING...</div>
  if (error) return (
    <div className="font-mono text-red-400 text-sm border border-red-900/50 bg-red-950/20 px-3 py-2">
      Failed to load matches: {error.message}
    </div>
  )

  const { mostRecentPin, biggestDiff, longestStreak, bestTournament } = computeRecords(matches)
  const totalMatches = matches.length
  const wins = matches.filter(m => m.result === 'win').length
  const pins = matches.filter(m => m.win_type === 'pin').length
  const pinRate = wins > 0 ? Math.round((pins / wins) * 100) : null

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">RECORDS</h1>

      {totalMatches === 0 ? (
        <p className="font-mono text-xs text-[#333]">Log matches to start building your records.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <RecordCard
              label="LONGEST WIN STREAK"
              value={longestStreak ? `${longestStreak.wins} IN A ROW` : null}
              sub={longestStreak ? `ended ${new Date(longestStreak.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null}
            />
            <RecordCard
              label="BIGGEST POINT DIFFERENTIAL"
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
          </div>

          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
            <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-4">CAREER SUMMARY</div>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <div className="text-[10px] font-display text-[#aaa] tracking-[0.15em]">TOTAL MATCHES</div>
                <div className="font-mono text-2xl text-[#f0f0f0] mt-1">{totalMatches}</div>
              </div>
              <div>
                <div className="text-[10px] font-display text-[#aaa] tracking-[0.15em]">WIN RATE</div>
                <div className="font-mono text-2xl text-[#f0f0f0] mt-1">
                  {totalMatches > 0 ? `${Math.round((wins / totalMatches) * 100)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-display text-[#aaa] tracking-[0.15em]">TOTAL PINS</div>
                <div className="font-mono text-2xl text-[#f0f0f0] mt-1">{pins}</div>
              </div>
              <div>
                <div className="text-[10px] font-display text-[#aaa] tracking-[0.15em]">PIN RATE</div>
                <div className="font-mono text-2xl text-[#f0f0f0] mt-1">
                  {pinRate !== null ? `${pinRate}%` : '—'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
