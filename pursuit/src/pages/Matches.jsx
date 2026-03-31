import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const WIN_TYPES = ['decision', 'major', 'tech', 'pin', 'forfeit']
const RESULTS = ['win', 'loss', 'draw']

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2'

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [opponent, setOpponent] = useState('')
  const [result, setResult] = useState('win')
  const [score, setScore] = useState('')
  const [winType, setWinType] = useState('decision')
  const [tournament, setTournament] = useState('')
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    loadMatches()
  }, [])

  async function loadMatches() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('wrestler_id', session.user.id)
        .order('match_date', { ascending: false })
      if (error) throw error
      setMatches(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.from('matches').insert({
        wrestler_id: session.user.id,
        opponent_name: opponent,
        result,
        score: score || null,
        win_type: result === 'win' ? winType : null,
        tournament: tournament || null,
        match_date: matchDate,
      })
      if (error) throw error
      setOpponent('')
      setScore('')
      setTournament('')
      setMatchDate(new Date().toISOString().split('T')[0])
      await loadMatches()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="font-mono text-[#444] text-xs tracking-[0.3em]">LOADING...</div>
  if (error) return <div className="font-mono text-red-400 text-sm">{error}</div>

  const wins = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length

  return (
    <div className="space-y-8">
      {/* Header with record */}
      <div className="flex items-end justify-between">
        <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">MATCHES</h1>
        <div className="font-mono text-4xl font-bold leading-none">
          <span className="text-green-500">{wins}</span>
          <span className="text-[#333] mx-2">—</span>
          <span className="text-red-500">{losses}</span>
        </div>
      </div>

      {/* Form */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">ADD MATCH</div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>OPPONENT</label>
              <input
                value={opponent}
                onChange={e => setOpponent(e.target.value)}
                required
                className={inputClass}
                placeholder="Last, First"
              />
            </div>
            <div>
              <label className={labelClass}>RESULT</label>
              <select
                value={result}
                onChange={e => setResult(e.target.value)}
                className={inputClass}
              >
                {RESULTS.map(r => (
                  <option key={r} value={r}>{r.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>SCORE</label>
              <input
                value={score}
                onChange={e => setScore(e.target.value)}
                className={inputClass}
                placeholder="8-2"
              />
            </div>
            {result === 'win' && (
              <div>
                <label className={labelClass}>WIN TYPE</label>
                <select
                  value={winType}
                  onChange={e => setWinType(e.target.value)}
                  className={inputClass}
                >
                  {WIN_TYPES.map(t => (
                    <option key={t} value={t}>{t.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass}>TOURNAMENT</label>
              <input
                value={tournament}
                onChange={e => setTournament(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>DATE</label>
              <input
                type="date"
                value={matchDate}
                onChange={e => setMatchDate(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-4">
            {submitError && (
              <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2 mb-3">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-2.5 bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] hover:bg-[#b45309] transition-colors disabled:opacity-40"
            >
              {submitting ? 'SAVING...' : 'ADD MATCH'}
            </button>
          </div>
        </form>
      </div>

      {/* Match list */}
      <div className="border border-[#1a1a1a]">
        {/* Header row */}
        <div className="grid grid-cols-5 px-5 py-3 border-b border-[#1a1a1a] bg-[#080808]">
          {['DATE', 'OPPONENT', 'RESULT', 'SCORE', 'TOURNAMENT'].map(h => (
            <div key={h} className="text-[10px] font-display tracking-[0.15em] text-[#444]">{h}</div>
          ))}
        </div>
        {matches.length === 0 ? (
          <div className="px-5 py-6 font-mono text-xs text-[#333]">No matches logged yet.</div>
        ) : (
          matches.map(m => (
            <div
              key={m.id}
              className="grid grid-cols-5 px-5 py-3.5 border-b border-[#111] hover:bg-[#0d0d0d] transition-colors"
            >
              <div className="font-mono text-[11px] text-[#555]">
                {new Date(m.match_date)
                  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  .toUpperCase()}
              </div>
              <div className="font-mono text-sm text-[#ccc]">{m.opponent_name}</div>
              <div
                className={`font-mono text-[11px] font-bold tracking-wider ${
                  m.result === 'win'
                    ? 'text-green-500'
                    : m.result === 'loss'
                    ? 'text-red-500'
                    : 'text-[#555]'
                }`}
              >
                {m.result.toUpperCase()}
                {m.win_type ? ` · ${m.win_type.toUpperCase()}` : ''}
              </div>
              <div className="font-mono text-sm text-[#ccc]">{m.score || '—'}</div>
              <div className="font-mono text-[11px] text-[#555]">{m.tournament || '—'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
