import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL
const PAGE_SIZE = 15

const WIN_TYPES = ['decision', 'major', 'tech', 'pin', 'forfeit']
const RESULTS = ['win', 'loss', 'draw']

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a] min-h-[44px]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#aaa] mb-2'

export default function Matches() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [page, setPage] = useState(0)
  const [allMatches, setAllMatches] = useState([])

  const [opponent, setOpponent] = useState('')
  const [result, setResult] = useState('win')
  const [score, setScore] = useState('')
  const [winType, setWinType] = useState('decision')
  const [tournamentId, setTournamentId] = useState('')   // '' = none, '__new__' = add new
  const [newTournamentName, setNewTournamentName] = useState('')
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Match outcome prediction
  const [outcomeWeight, setOutcomeWeight] = useState('')
  const [outcomeClass, setOutcomeClass] = useState('')
  const [outcomeResult, setOutcomeResult] = useState(null)
  const [outcomeLoading, setOutcomeLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  // All-time W-L record (no range limit)
  const { data: allResults = [] } = useQuery({
    queryKey: ['matches-record', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('result')
        .eq('wrestler_id', uid)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 60_000,
  })

  // Tournaments dropdown
  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, date')
        .eq('wrestler_id', uid)
        .order('date', { ascending: false, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 60_000,
  })

  // Paginated match list — join tournaments for name display
  const { data: pageData, isFetching, isLoading, error } = useQuery({
    queryKey: ['matches', uid, page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, match_date, opponent_name, result, score, win_type, tournament, tournament_id, tournaments(name)')
        .eq('wrestler_id', uid)
        .order('match_date', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  // Accumulate pages
  useEffect(() => {
    if (!pageData) return
    if (page === 0) {
      setAllMatches(pageData)
    } else {
      setAllMatches(prev => [...prev, ...pageData])
    }
  }, [pageData]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id

      // Resolve tournament: create a new one if "Add new" was selected
      let resolvedTournamentId = tournamentId === '' ? null : tournamentId
      if (tournamentId === '__new__') {
        if (!newTournamentName.trim()) {
          setSubmitError('Enter a tournament name or select "None".')
          setSubmitting(false)
          return
        }
        const { data: tData, error: tErr } = await supabase
          .from('tournaments')
          .insert({ wrestler_id: uid, name: newTournamentName.trim() })
          .select('id')
          .single()
        if (tErr) throw tErr
        resolvedTournamentId = tData.id
        queryClient.invalidateQueries({ queryKey: ['tournaments', uid] })
      }

      const { error } = await supabase.from('matches').insert({
        wrestler_id: uid,
        opponent_name: opponent,
        result,
        score: score || null,
        win_type: result === 'win' ? winType : null,
        tournament_id: resolvedTournamentId,
        match_date: matchDate,
      })
      if (error) throw error
      setOpponent('')
      setScore('')
      setTournamentId('')
      setNewTournamentName('')
      setMatchDate(new Date().toISOString().split('T')[0])
      setPage(0)
      setAllMatches([])
      queryClient.invalidateQueries({ queryKey: ['matches', uid] })
      queryClient.invalidateQueries({ queryKey: ['matches-record', uid] })
      queryClient.invalidateQueries({ queryKey: ['matches-dropdown', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMatchOutcome(e) {
    e.preventDefault()
    setOutcomeResult(null)
    setOutcomeLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${API_URL}/predict/match-outcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          your_weight_on_day: parseFloat(outcomeWeight),
          target_weight_class: parseInt(outcomeClass),
        }),
      })
      if (res.ok) setOutcomeResult(await res.json())
    } catch {
      // fail silently
    } finally {
      setOutcomeLoading(false)
    }
  }

  const wins = allResults.filter(m => m.result === 'win').length
  const losses = allResults.filter(m => m.result === 'loss').length
  const totalMatches = allResults.length
  const hasMore = pageData?.length === PAGE_SIZE

  if (isLoading && page === 0) {
    return <div className="font-mono text-[#888] text-xs tracking-[0.3em]">LOADING...</div>
  }

  if (error) {
    return (
      <div className="font-mono text-red-400 text-sm border border-red-900/50 bg-red-950/20 px-3 py-2">
        Failed to load matches: {error.message}
      </div>
    )
  }

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
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">ADD MATCH</div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <select
                value={tournamentId}
                onChange={e => { setTournamentId(e.target.value); setNewTournamentName('') }}
                className={inputClass}
              >
                <option value="">— None —</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="__new__">＋ Add new…</option>
              </select>
              {tournamentId === '__new__' && (
                <input
                  type="text"
                  value={newTournamentName}
                  onChange={e => setNewTournamentName(e.target.value)}
                  placeholder="Tournament name"
                  className={`${inputClass} mt-2`}
                />
              )}
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
              className="w-full md:w-auto px-8 py-2.5 bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] hover:bg-[#b45309] transition-colors disabled:opacity-40 min-h-[44px]"
            >
              {submitting ? 'SAVING...' : 'ADD MATCH'}
            </button>
          </div>
        </form>
      </div>

      {/* Match outcome predictor */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
        <div className="flex items-baseline gap-4 mb-5">
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706]">MATCH OUTCOME PREDICTOR</div>
          {totalMatches < 10 && (
            <div className="text-[10px] font-mono text-[#888]">
              {10 - totalMatches} more match{10 - totalMatches !== 1 ? 'es' : ''} needed for a real prediction
            </div>
          )}
        </div>
        <form onSubmit={handleMatchOutcome} className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="w-full md:w-44">
            <label className="block text-[10px] tracking-[0.15em] font-display text-[#aaa] mb-2">YOUR WEIGHT (LBS)</label>
            <input
              type="number"
              step="0.1"
              min="50"
              max="400"
              inputMode="decimal"
              value={outcomeWeight}
              onChange={e => setOutcomeWeight(e.target.value)}
              required
              className="w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a] min-h-[44px]"
              placeholder="155.0"
            />
          </div>
          <div className="w-full md:w-44">
            <label className="block text-[10px] tracking-[0.15em] font-display text-[#aaa] mb-2">TARGET CLASS (LBS)</label>
            <input
              type="number"
              inputMode="numeric"
              value={outcomeClass}
              onChange={e => setOutcomeClass(e.target.value)}
              required
              className="w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a] min-h-[44px]"
              placeholder="152"
            />
          </div>
          <button
            type="submit"
            disabled={outcomeLoading}
            className="w-full md:w-auto border border-[#d97706] text-[#d97706] font-display font-bold text-[10px] tracking-[0.25em] px-6 py-2.5 hover:bg-[#d97706]/10 transition-colors disabled:opacity-40 shrink-0 min-h-[44px]"
          >
            {outcomeLoading ? 'ANALYZING...' : 'PREDICT'}
          </button>
        </form>

        {outcomeResult && (
          <div className="mt-5 pt-4 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-8 mb-4">
              <div>
                <div className="text-[10px] font-display text-[#aaa] tracking-[0.15em]">WIN PROBABILITY</div>
                <div className="font-mono text-3xl font-bold text-[#f0f0f0] mt-1">
                  {(outcomeResult.win_probability * 100).toFixed(0)}
                  <span className="text-sm text-[#aaa] ml-1">%</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-display text-[#aaa] tracking-[0.15em]">CONFIDENCE</div>
                <div className={`font-mono text-sm font-bold mt-1 tracking-wider ${
                  outcomeResult.confidence === 'high' ? 'text-green-500'
                  : outcomeResult.confidence === 'medium' ? 'text-[#d97706]'
                  : 'text-[#aaa]'
                }`}>
                  {outcomeResult.confidence.toUpperCase()}
                </div>
              </div>
            </div>
            <ul className="space-y-1">
              {outcomeResult.factors.map((f, i) => (
                <li key={i} className="font-mono text-[11px] text-[#666] before:content-['—'] before:mr-2 before:text-[#333]">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Match list */}
      <div className="overflow-x-auto">
      <div className="border border-[#1a1a1a] min-w-[520px]">
        <div className="grid grid-cols-5 px-5 py-3 border-b border-[#1a1a1a] bg-[#080808]">
          {['DATE', 'OPPONENT', 'RESULT', 'SCORE', 'TOURNAMENT'].map(h => (
            <div key={h} className="text-[10px] font-display tracking-[0.15em] text-[#888]">{h}</div>
          ))}
        </div>
        {allMatches.length === 0 ? (
          <div className="px-5 py-6 font-mono text-xs text-[#333]">No matches logged yet.</div>
        ) : (
          allMatches.map(m => (
            <div
              key={m.id}
              className="grid grid-cols-5 px-5 py-3.5 border-b border-[#111] hover:bg-[#0d0d0d] transition-colors"
            >
              <div className="font-mono text-[11px] text-[#aaa]">
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
                    : 'text-[#aaa]'
                }`}
              >
                {m.result.toUpperCase()}
                {m.win_type ? ` · ${m.win_type.toUpperCase()}` : ''}
              </div>
              <div className="font-mono text-sm text-[#ccc]">{m.score || '—'}</div>
              <div className="font-mono text-[11px] text-[#aaa]">
                {m.tournaments?.name ?? m.tournament ?? '—'}
              </div>
            </div>
          ))
        )}
      </div>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={isFetching}
            className="px-6 py-2 border border-[#1e1e1e] font-display text-[10px] tracking-[0.18em] text-[#aaa] hover:border-[#d97706] hover:text-[#d97706] transition-colors disabled:opacity-40"
          >
            {isFetching ? 'LOADING...' : 'LOAD MORE'}
          </button>
          {isFetching && (
            <span className="font-mono text-[10px] text-[#333]">fetching...</span>
          )}
        </div>
      )}
    </div>
  )
}
