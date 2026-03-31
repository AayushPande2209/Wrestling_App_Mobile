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

export default function Dashboard() {
  const [wrestler, setWrestler] = useState(null)
  const [latestLog, setLatestLog] = useState(null)
  const [matches, setMatches] = useState([])
  const [nextEvent, setNextEvent] = useState(null)
  const [prediction, setPrediction] = useState(null)
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

      const [
        { data: wrestlerData },
        { data: logs },
        { data: matchData },
        { data: events },
      ] = await Promise.all([
        supabase.from('wrestlers').select('*').eq('id', uid).single(),
        supabase.from('weight_logs').select('weight, logged_at').eq('wrestler_id', uid).order('logged_at', { ascending: false }).limit(1),
        supabase.from('matches').select('result').eq('wrestler_id', uid),
        supabase.from('schedules').select('*').eq('wrestler_id', uid).gt('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1),
      ])

      setWrestler(wrestlerData)
      setLatestLog(logs?.[0] ?? null)
      setMatches(matchData ?? [])
      setNextEvent(events?.[0] ?? null)

      if (wrestlerData?.weight_class && logs?.[0] && events?.[0]) {
        try {
          const daysUntil = Math.max(
            1,
            Math.ceil((new Date(events[0].starts_at) - new Date()) / 86400000)
          )
          const res = await fetch(`${API_URL}/predict/weight-cut`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              current_weight: logs[0].weight,
              target_weight_class: wrestlerData.weight_class,
              days_until_weigh_in: daysUntil,
            }),
          })
          if (res.ok) setPrediction(await res.json())
        } catch {
          // fail silently — API may be unreachable
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="font-mono text-[#444] text-xs tracking-[0.3em]">LOADING...</div>
  }
  if (error) {
    return <div className="font-mono text-red-400 text-sm">{error}</div>
  }

  const wins = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length
  const lbsToCut =
    latestLog && wrestler?.weight_class
      ? (latestLog.weight - wrestler.weight_class).toFixed(1)
      : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">DASHBOARD</h1>
        {wrestler?.name && (
          <p className="font-mono text-[10px] text-[#444] mt-1 tracking-[0.2em]">
            {wrestler.name.toUpperCase()}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="CURRENT WEIGHT" value={latestLog ? `${latestLog.weight} LBS` : '—'} />
        <StatBox label="WEIGHT CLASS" value={wrestler?.weight_class ? `${wrestler.weight_class} LBS` : '—'} />
        <StatBox
          label="TO CUT"
          value={lbsToCut !== null ? `${lbsToCut} LBS` : '—'}
          highlight={lbsToCut !== null && parseFloat(lbsToCut) > 5}
        />
        <StatBox label="RECORD" value={`${wins}—${losses}`} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Cut analysis */}
        {prediction && (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
            <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-4">
              CUT ANALYSIS
            </div>
            <p className="font-mono text-sm text-[#ccc] leading-relaxed">
              {prediction.recommendation}
            </p>
            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-[#1a1a1a]">
              <div>
                <div className="text-[10px] font-display text-[#555] tracking-[0.15em] mb-1">DAILY RATE</div>
                <div className="font-mono text-xl text-[#f0f0f0]">
                  {prediction.daily_cut_rate}{' '}
                  <span className="text-xs text-[#555]">LBS/DAY</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-display text-[#555] tracking-[0.15em] mb-1">STATUS</div>
                <div
                  className={`font-mono text-sm font-bold mt-1 ${
                    prediction.is_safe ? 'text-green-500' : 'text-[#d97706]'
                  }`}
                >
                  {prediction.is_safe ? 'SAFE' : 'AGGRESSIVE'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next event */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-4">NEXT EVENT</div>
          {nextEvent ? (
            <>
              <div className="font-display font-semibold text-base text-[#f0f0f0] tracking-wide">
                {nextEvent.title}
              </div>
              <div className="font-mono text-[11px] text-[#555] mt-2">
                {new Date(nextEvent.starts_at)
                  .toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  .toUpperCase()}
              </div>
              {nextEvent.location && (
                <div className="font-mono text-[11px] text-[#555] mt-1">
                  {nextEvent.location.toUpperCase()}
                </div>
              )}
            </>
          ) : (
            <p className="font-mono text-xs text-[#333]">No upcoming events scheduled.</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <div className="text-[10px] font-display tracking-[0.15em] text-[#555] mb-3">QUICK ACTIONS</div>
        <div className="flex gap-3">
          {[
            { label: 'LOG WEIGHT', to: '/weight' },
            { label: 'ADD MATCH', to: '/matches' },
            { label: 'ADD NOTE', to: '/notes' },
          ].map(({ label, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="px-5 py-2.5 border border-[#1e1e1e] font-display text-[10px] tracking-[0.18em] text-[#888] hover:border-[#d97706] hover:text-[#d97706] transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
