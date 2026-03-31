import { useState, useEffect } from 'react'
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

export default function WeightLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  // Log form
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Cut predictor
  const [cutTarget, setCutTarget] = useState('')
  const [cutDays, setCutDays] = useState('')
  const [cutResult, setCutResult] = useState(null)
  const [cutLoading, setCutLoading] = useState(false)
  const [cutError, setCutError] = useState(null)

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('weight_logs')
        .select('weight, logged_at, note')
        .eq('wrestler_id', session.user.id)
        .order('logged_at', { ascending: true })
        .limit(30)
      setLogs(data ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleLog(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session.user.id
      const { error } = await supabase.from('weight_logs').insert({
        wrestler_id: uid,
        weight: parseFloat(weight),
        note: note || null,
        logged_at: new Date().toISOString(),
      })
      if (error) throw error
      await supabase.from('wrestlers').update({ current_weight: parseFloat(weight) }).eq('id', uid)
      setWeight('')
      setNote('')
      setSubmitSuccess(true)
      loadLogs()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCutPredict(e) {
    e.preventDefault()
    setCutResult(null)
    setCutError(null)
    setCutLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
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
      if (!res.ok) throw new Error('Prediction failed')
      setCutResult(await res.json())
    } catch (err) {
      setCutError(err.message)
    } finally {
      setCutLoading(false)
    }
  }

  const chartData = logs.map(l => ({
    date: new Date(l.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: l.weight,
  }))

  const inputClass =
    'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a]'
  const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2'

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">WEIGHT LOG</h1>

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
              <label className={labelClass}>NOTE (OPTIONAL)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                className={inputClass}
                placeholder="morning, post-practice..."
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

          {cutError && (
            <p className="text-[11px] font-mono text-red-400 mt-4">{cutError}</p>
          )}

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

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-6">
            WEIGHT TREND — LAST {chartData.length} LOGS
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
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #1e1e1e',
                  borderRadius: 0,
                  fontFamily: 'JetBrains Mono',
                  fontSize: 12,
                  color: '#f0f0f0',
                }}
                labelStyle={{ color: '#555', marginBottom: 4 }}
                cursor={{ stroke: '#1e1e1e' }}
              />
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
