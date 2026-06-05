import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'

const RESULT_COLOR = { win: '#22c55e', loss: '#ef4444', draw: '#555' }

function CustomDot({ cx, cy, payload }) {
  if (!payload.result) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={RESULT_COLOR[payload.result] ?? '#555'}
      stroke="#0a0a0a"
      strokeWidth={1.5}
    />
  )
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-[#0a0a0a] border border-[#1e1e1e] px-3 py-2 font-mono text-[11px] text-[#f0f0f0]">
      <div className="text-[#aaa] mb-1">{d.label}</div>
      {d.weight != null && <div>{d.weight} LBS</div>}
      {d.result && (
        <div style={{ color: RESULT_COLOR[d.result] }}>
          {d.result.toUpperCase()}{d.opponent ? ` vs ${d.opponent}` : ''}
          {d.score ? ` (${d.score})` : ''}
        </div>
      )}
    </div>
  )
}

// Accepts uid prop so it can be embedded in Dashboard without re-fetching the session.
export default function TimelineView({ uid }) {
  const { data: weightLogs = [], isLoading: wLoading, error: wError } = useQuery({
    queryKey: ['weight-logs-all', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('weight, logged_at')
        .eq('wrestler_id', uid)
        .order('logged_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  const { data: matches = [], isLoading: mLoading, error: mError } = useQuery({
    queryKey: ['matches-timeline', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('match_date, result, opponent_name, score')
        .eq('wrestler_id', uid)
        .order('match_date', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  if (wLoading || mLoading) {
    return <div className="font-mono text-[#888] text-xs tracking-[0.3em]">LOADING...</div>
  }

  const loadError = wError || mError
  if (loadError) return (
    <div className="font-mono text-red-400 text-sm border border-red-900/50 bg-red-950/20 px-3 py-2">
      Failed to load timeline: {loadError.message}
    </div>
  )

  const weightByDate = {}
  for (const log of weightLogs) {
    const d = log.logged_at.slice(0, 10)
    weightByDate[d] = log.weight
  }

  const allDates = Array.from(new Set([
    ...weightLogs.map(l => l.logged_at.slice(0, 10)),
    ...matches.map(m => m.match_date),
  ])).sort()

  const filledWeight = {}
  let lastW = null
  for (const d of allDates) {
    if (weightByDate[d] != null) lastW = weightByDate[d]
    filledWeight[d] = lastW
  }

  const lineData = weightLogs.map(l => ({
    date: l.logged_at.slice(0, 10),
    weight: l.weight,
    label: new Date(l.logged_at.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }))

  const scatterData = matches.map(m => ({
    date: m.match_date,
    weight: filledWeight[m.match_date] ?? null,
    result: m.result,
    opponent: m.opponent_name,
    score: m.score,
    label: new Date(m.match_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  })).filter(d => d.weight != null)

  const hasData = lineData.length > 0

  const tickDates = lineData.length > 8
    ? lineData.filter((_, i) => i % Math.ceil(lineData.length / 8) === 0).map(d => d.date)
    : lineData.map(d => d.date)

  return (
    <div className="space-y-8">
      {!hasData ? (
        <p className="font-mono text-xs text-[#333]">Log weight entries to see your season timeline.</p>
      ) : (
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-2">
            WEIGHT + MATCH RESULTS
          </div>
          <div className="flex items-center gap-6 mb-6">
            {[['#22c55e', 'WIN'], ['#ef4444', 'LOSS'], ['#555', 'DRAW']].map(([color, label]) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="font-mono text-[10px] text-[#aaa]">{label}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="#161616" />
              <XAxis
                dataKey="date"
                type="category"
                allowDuplicatedCategory={false}
                ticks={tickDates}
                tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: '#1a1a1a' }}
                tickLine={false}
                tickFormatter={d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis
                tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                data={lineData}
                type="monotone"
                dataKey="weight"
                stroke="#d97706"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#d97706', strokeWidth: 0 }}
              />
              <Scatter
                data={scatterData}
                dataKey="weight"
                shape={<CustomDot />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {matches.length > 0 && (
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-4">RECENT MATCHES</div>
          <div className="space-y-2">
            {[...matches].reverse().slice(0, 10).map((m, i) => (
              <div key={i} className="flex items-center gap-4 font-mono text-[11px]">
                <span className="text-[#333] w-20 shrink-0">
                  {new Date(m.match_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ color: RESULT_COLOR[m.result] }} className="w-10 font-bold shrink-0">
                  {m.result.toUpperCase()}
                </span>
                <span className="text-[#888]">vs {m.opponent_name}</span>
                {m.score && <span className="text-[#888]">{m.score}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
