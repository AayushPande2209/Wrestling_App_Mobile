import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL

const TIME_OF_DAY_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'before_practice', label: 'Before Practice' },
  { value: 'after_practice', label: 'After Practice' },
  { value: 'night', label: 'Night' },
]

const TIME_OF_DAY_LABELS = {
  morning: 'Morning',
  before_practice: 'Before Practice',
  after_practice: 'After Practice',
  night: 'Night',
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { date, entries } = payload[0].payload
  return (
    <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-3 min-w-[160px]">
      <div className="font-mono text-[10px] text-[#555] tracking-[0.1em] mb-2">{date}</div>
      {entries.map((e, i) => (
        <div key={i} className="mb-1.5 last:mb-0">
          <div className="font-mono text-xs text-[#f0f0f0]">
            {e.weight} <span className="text-[#555]">LBS</span>
            <span className="text-[#d97706] ml-2">· {TIME_OF_DAY_LABELS[e.time_of_day] ?? e.time_of_day}</span>
          </div>
          {e.note && (
            <div className="font-mono text-[10px] text-[#444] mt-0.5 leading-snug">{e.note}</div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function WeightLog() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)

  // Log form
  const [weight, setWeight] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Cut predictor
  const [cutTarget, setCutTarget] = useState('')
  const [cutDays, setCutDays] = useState('')
  const [cutResult, setCutResult] = useState(null)
  const [cutLoading, setCutLoading] = useState(false)

  // Weight trend predictor
  const [trendDate, setTrendDate] = useState('')
  const [trendResult, setTrendResult] = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['weight-logs', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('weight, time_of_day, logged_at, note')
        .eq('wrestler_id', uid)
        .order('logged_at', { ascending: true })
        .limit(90)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  async function handleLog(e) {
    e.preventDefault()
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
      // current_weight always reflects the most recent individual log
      await supabase.from('wrestlers').update({ current_weight: parseFloat(weight) }).eq('id', uid)
      setWeight('')
      setTimeOfDay('')
      setNote('')
      setSubmitSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['weight-logs', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCutPredict(e) {
    e.preventDefault()
    setCutResult(null)
    setCutLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const currentWeight =
        logs.length > 0 ? logs[logs.length - 1].weight : parseFloat(weight)
      const res = await fetch(`${API_URL}/predict/weight-cut`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          current_weight: currentWeight,
          target_weight_class: parseInt(cutTarget),
          days_until_weigh_in: parseInt(cutDays),
        }),
      })
      if (res.ok) setCutResult(await res.json())
    } catch {
      // fail silently — spec §3: if FastAPI is unreachable, prediction UI is hidden
    } finally {
      setCutLoading(false)
    }
  }

  async function handleWeightTrend(e) {
    e.preventDefault()
    setTrendResult(null)
    setTrendLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${API_URL}/predict/weight-trend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ target_date: trendDate }),
      })
      if (res.ok) setTrendResult(await res.json())
    } catch {
      // fail silently
    } finally {
      setTrendLoading(false)
    }
  }

  // Group logs by local date → compute daily average weight; preserve all entries for tooltip
  const chartData = (() => {
    const byDate = {}
    for (const log of logs) {
      const d = new Date(log.logged_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!byDate[key]) byDate[key] = { key, date: label, entries: [], total: 0, count: 0 }
      byDate[key].entries.push(log)
      byDate[key].total += log.weight
      byDate[key].count++
    }
    return Object.values(byDate)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(d => ({ date: d.date, weight: parseFloat((d.total / d.count).toFixed(1)), entries: d.entries }))
  })()

  const inputClass =
    'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a]'
  const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2'

  const confidenceColor = {
    high: 'text-green-500',
    medium: 'text-[#d97706]',
    low: 'text-[#555]',
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">WEIGHT LOG</h1>

      {error && (
        <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
          Failed to load logs: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Log form */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">LOG WEIGHT</div>
          <form onSubmit={handleLog} className="space-y-4">
            <div>
              <label className={labelClass}>WEIGHT (LBS)</label>
              <input
                type="number"
                step="0.1"
                min="50"
                max="400"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                required
                className={inputClass}
                placeholder="152.4"
              />
            </div>
            <div>
              <label className={labelClass}>TIME OF DAY</label>
              <select
                value={timeOfDay}
                onChange={e => setTimeOfDay(e.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>— Select —</option>
                {TIME_OF_DAY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>NOTE (OPTIONAL)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                className={inputClass}
                placeholder="felt heavy, post-practice..."
              />
            </div>
            {submitError && (
              <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
                {submitError}
              </p>
            )}
            {submitSuccess && (
              <p className="text-[11px] font-mono text-green-500">Weight logged.</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] py-3 hover:bg-[#b45309] transition-colors disabled:opacity-40"
            >
              {submitting ? 'LOGGING...' : 'LOG WEIGHT'}
            </button>
          </form>
        </div>

        {/* Cut predictor */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">CUT PREDICTOR</div>
          <form onSubmit={handleCutPredict} className="space-y-4">
            <div>
              <label className={labelClass}>TARGET CLASS (LBS)</label>
              <input
                type="number"
                min="50"
                max="400"
                value={cutTarget}
                onChange={e => setCutTarget(e.target.value)}
                required
                className={inputClass}
                placeholder="152"
              />
            </div>
            <div>
              <label className={labelClass}>DAYS UNTIL WEIGH-IN</label>
              <input
                type="number"
                min="1"
                value={cutDays}
                onChange={e => setCutDays(e.target.value)}
                required
                className={inputClass}
                placeholder="7"
              />
            </div>
            <button
              type="submit"
              disabled={cutLoading}
              className="w-full border border-[#d97706] text-[#d97706] font-display font-bold text-[10px] tracking-[0.25em] py-3 hover:bg-[#d97706]/10 transition-colors disabled:opacity-40"
            >
              {cutLoading ? 'ANALYZING...' : 'ANALYZE CUT'}
            </button>
          </form>

          {cutResult && (
            <div className="mt-5 pt-4 border-t border-[#1a1a1a] space-y-3">
              <p className="font-mono text-sm text-[#ccc] leading-relaxed">
                {cutResult.recommendation}
              </p>
              <div className="flex gap-6 pt-1">
                <div>
                  <div className="text-[10px] font-display text-[#555] tracking-[0.15em]">TO CUT</div>
                  <div className="font-mono text-xl text-[#f0f0f0] mt-1">
                    {cutResult.lbs_to_cut} <span className="text-xs text-[#555]">LBS</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-display text-[#555] tracking-[0.15em]">RATE</div>
                  <div className="font-mono text-xl text-[#f0f0f0] mt-1">
                    {cutResult.daily_cut_rate} <span className="text-xs text-[#555]">LBS/DAY</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-display text-[#555] tracking-[0.15em]">STATUS</div>
                  <div
                    className={`font-mono text-sm font-bold mt-1 ${
                      cutResult.is_safe ? 'text-green-500' : 'text-[#d97706]'
                    }`}
                  >
                    {cutResult.is_safe ? 'SAFE' : 'AGGRESSIVE'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weight trend predictor */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">WEIGHT TREND PREDICTOR</div>
        <form onSubmit={handleWeightTrend} className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className={labelClass}>TARGET DATE</label>
            <input
              type="date"
              value={trendDate}
              onChange={e => setTrendDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={trendLoading}
            className="border border-[#d97706] text-[#d97706] font-display font-bold text-[10px] tracking-[0.25em] px-6 py-2.5 hover:bg-[#d97706]/10 transition-colors disabled:opacity-40 shrink-0"
          >
            {trendLoading ? 'PREDICTING...' : 'PREDICT'}
          </button>
          {trendResult && (
            <div className="flex gap-8 ml-4">
              <div>
                <div className="text-[10px] font-display text-[#555] tracking-[0.15em]">PREDICTED WEIGHT</div>
                <div className="font-mono text-2xl text-[#f0f0f0] mt-1">
                  {trendResult.predicted_weight} <span className="text-xs text-[#555]">LBS</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-display text-[#555] tracking-[0.15em]">CONFIDENCE</div>
                <div className={`font-mono text-sm font-bold mt-1 tracking-wider ${confidenceColor[trendResult.confidence] ?? 'text-[#555]'}`}>
                  {trendResult.confidence.toUpperCase()}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Chart */}
      {!isLoading && chartData.length > 0 && (
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-6">
            DAILY AVERAGE — LAST {chartData.length} DAY{chartData.length !== 1 ? 'S' : ''}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="#161616" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: '#1a1a1a' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1e1e1e' }} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#d97706"
                strokeWidth={2}
                dot={{ r: 3, fill: '#d97706', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#d97706', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
