import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL

function StatBox({ label, value, highlight }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5">
      <div className="text-[10px] font-display tracking-[0.15em] text-[#555] mb-2">{label}</div>
      <div className={`font-mono text-3xl font-bold tracking-tight ${highlight ? 'text-[#d97706]' : 'text-[#f0f0f0]'}`}>
        {value}
      </div>
    </div>
  )
}

function localDateStr(date) {
  // Returns YYYY-MM-DD in the user's local timezone — avoids UTC shift issues
  // where e.g. an 11pm ET log is stored as the next UTC day.
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function computeStreak(logs) {
  // logs ordered descending by logged_at
  if (!logs.length) return 0
  // Convert each log timestamp to local date string for comparison
  const logDates = new Set(logs.map(l => localDateStr(new Date(l.logged_at))))

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  // If no log today, start checking from yesterday
  if (!logDates.has(localDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  while (logDates.has(localDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function Dashboard() {
  const [wrestler, setWrestler] = useState(null)
  const [latestLog, setLatestLog] = useState(null)
  const [allLogs, setAllLogs] = useState([])
  const [matches, setMatches] = useState([])
  const [nextEvent, setNextEvent] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [perfTrend, setPerfTrend] = useState(null)
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

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
        supabase.from('weight_logs').select('logged_at').eq('wrestler_id', uid).order('logged_at', { ascending: false }).limit(90),
        supabase.from('matches').select('result').eq('wrestler_id', uid),
        supabase.from('schedules').select('id, title, starts_at, location').eq('wrestler_id', uid).gt('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1),
      ])

      setWrestler(wrestlerData)
      setLatestLog(logs?.[0] ?? null)
      setAllLogs(allLogsData ?? [])
      setMatches(matchData ?? [])
      setNextEvent(events?.[0] ?? null)

      // Activity feed — isolated try/catch so RLS errors don't crash the dashboard
      try {
        const [{ data: feedLogs }, { data: feedMatches }, { data: feedEvents }] = await Promise.all([
          supabase.from('weight_logs').select('weight, logged_at, wrestler_id, wrestlers!inner(name, show_on_board)').neq('wrestler_id', uid).gte('logged_at', cutoff48h).eq('wrestlers.show_on_board', true).order('logged_at', { ascending: false }).limit(20),
          supabase.from('matches').select('result, match_date, created_at, opponent_name, wrestler_id, wrestlers!inner(name, show_on_board)').neq('wrestler_id', uid).gte('created_at', cutoff48h).eq('wrestlers.show_on_board', true).order('created_at', { ascending: false }).limit(20),
          supabase.from('schedules').select('title, starts_at, wrestler_id, wrestlers!inner(name, show_on_board)').neq('wrestler_id', uid).gte('created_at', cutoff48h).eq('wrestlers.show_on_board', true).order('created_at', { ascending: false }).limit(20),
        ])
        const feedItems = []
        const safeName = (raw) => {
          if (!raw || raw.includes('@')) return 'Wrestler'
          return raw
        }
        for (const l of feedLogs ?? []) {
          feedItems.push({ type: 'weight', name: safeName(l.wrestlers?.name), text: `logged ${l.weight} lbs`, ts: l.logged_at })
        }
        for (const m of feedMatches ?? []) {
          feedItems.push({ type: 'match', name: safeName(m.wrestlers?.name), text: `${m.result === 'win' ? 'won' : m.result === 'loss' ? 'lost' : 'drew'} vs ${m.opponent_name}`, ts: m.created_at })
        }
        for (const e of feedEvents ?? []) {
          feedItems.push({ type: 'event', name: safeName(e.wrestlers?.name), text: `added event: ${e.title}`, ts: e.starts_at })
        }
        feedItems.sort((a, b) => b.ts.localeCompare(a.ts))
        setFeed(feedItems.slice(0, 15))
      } catch {
        // Feed fails silently — core dashboard remains functional even if
        // show_on_board RLS policies haven't been applied to the live DB yet
      }

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

  if (loading) return <div className="font-mono text-[#444] text-xs tracking-[0.3em]">LOADING...</div>
  if (error) return <div className="font-mono text-red-400 text-sm">{error}</div>

  // Show name only when it has been set to something other than the email default
  const displayName = wrestler?.name && wrestler.name !== wrestler?.email ? wrestler.name : null

  const wins = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length
  const rawCut = latestLog && wrestler?.weight_class ? latestLog.weight - wrestler.weight_class : null
  const onWeight = rawCut !== null && rawCut <= 0
  const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null
  const streak = computeStreak(allLogs)

  const trendColor =
    perfTrend?.trend === 'improving' ? 'text-green-500'
    : perfTrend?.trend === 'declining' ? 'text-red-400'
    : 'text-[#555]'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">DASHBOARD</h1>
        {displayName && (
          <p className="font-mono text-[10px] text-[#444] mt-1 tracking-[0.2em]">{displayName.toUpperCase()}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox label="CURRENT WEIGHT" value={latestLog ? `${latestLog.weight} LBS` : '—'} />
        <StatBox label="WEIGHT CLASS" value={wrestler?.weight_class ? `${wrestler.weight_class} LBS` : '—'} />
        <StatBox
          label="TO CUT"
          value={lbsToCut !== null ? (onWeight ? 'ON WEIGHT' : `${lbsToCut.toFixed(1)} LBS`) : '—'}
          highlight={lbsToCut !== null && !onWeight && lbsToCut > 5}
        />
        <StatBox label="RECORD" value={`${wins}—${losses}`} />
        <StatBox label="LOG STREAK" value={streak > 0 ? `${streak}D` : '—'} highlight={streak >= 7} />
      </div>

      {/* Performance trend */}
      {perfTrend && (
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-4">PERFORMANCE TREND</div>
          <div className="flex flex-wrap items-start gap-6 md:gap-10">
            <div>
              <div className="text-[10px] font-display text-[#555] tracking-[0.15em] mb-1">OVERALL WIN RATE</div>
              <div className="font-mono text-2xl text-[#f0f0f0]">
                {(perfTrend.win_rate * 100).toFixed(0)}<span className="text-xs text-[#555] ml-1">%</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-display text-[#555] tracking-[0.15em] mb-1">RECENT WIN RATE</div>
              <div className="font-mono text-2xl text-[#f0f0f0]">
                {(perfTrend.recent_win_rate * 100).toFixed(0)}<span className="text-xs text-[#555] ml-1">%</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-display text-[#555] tracking-[0.15em] mb-1">TREND</div>
              <div className={`font-mono text-sm font-bold tracking-wider mt-1 ${trendColor}`}>
                {perfTrend.trend.toUpperCase()}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-display text-[#555] tracking-[0.15em] mb-1">INSIGHT</div>
              <div className="font-mono text-sm text-[#ccc] leading-relaxed">{perfTrend.insight}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Cut analysis */}
        {prediction && (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
            <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-4">CUT ANALYSIS</div>
            <p className="font-mono text-sm text-[#ccc] leading-relaxed">{prediction.recommendation}</p>
            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-[#1a1a1a]">
              <div>
                <div className="text-[10px] font-display text-[#555] tracking-[0.15em] mb-1">DAILY RATE</div>
                <div className="font-mono text-xl text-[#f0f0f0]">
                  {prediction.daily_cut_rate} <span className="text-xs text-[#555]">LBS/DAY</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-display text-[#555] tracking-[0.15em] mb-1">STATUS</div>
                <div className={`font-mono text-sm font-bold mt-1 ${prediction.is_safe ? 'text-green-500' : 'text-[#d97706]'}`}>
                  {prediction.is_safe ? 'SAFE' : 'AGGRESSIVE'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next event */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-4">NEXT EVENT</div>
          {nextEvent ? (
            <>
              <div className="font-display font-semibold text-base text-[#f0f0f0] tracking-wide">{nextEvent.title}</div>
              <div className="font-mono text-[11px] text-[#555] mt-2">
                {new Date(nextEvent.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </div>
              {nextEvent.location && (
                <div className="font-mono text-[11px] text-[#555] mt-1">{nextEvent.location.toUpperCase()}</div>
              )}
            </>
          ) : (
            <p className="font-mono text-xs text-[#333]">No upcoming events scheduled.</p>
          )}
        </div>
      </div>

      {/* Activity feed */}
      {feed.length > 0 && (
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-4">TEAM ACTIVITY — LAST 48H</div>
          <div className="space-y-2">
            {feed.map((item, i) => (
              <div key={i} className="flex items-baseline gap-3 font-mono text-[11px]">
                <span className="text-[#333] shrink-0 w-28">
                  {new Date(item.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[#d97706] shrink-0">{item.name}</span>
                <span className="text-[#555]">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <div className="text-[10px] font-display tracking-[0.15em] text-[#555] mb-3">QUICK ACTIONS</div>
        <div className="flex flex-col md:flex-row gap-3">
          {[
            { label: 'LOG WEIGHT', to: '/weight' },
            { label: 'ADD MATCH', to: '/matches' },
            { label: 'ADD NOTE', to: '/notes' },
          ].map(({ label, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="w-full md:w-auto px-5 py-2.5 border border-[#1e1e1e] font-display text-[10px] tracking-[0.18em] text-[#888] hover:border-[#d97706] hover:text-[#d97706] transition-colors min-h-[44px]"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
