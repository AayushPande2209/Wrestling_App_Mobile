import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20
const CONTEXTS = ['general', 'practice', 'match']

const CONTEXT_STYLE = {
  practice: 'text-blue-400 border-blue-900/60',
  match: 'text-[#d97706] border-amber-800/60',
  general: 'text-[#555] border-[#2a2a2a]',
}

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2'

export default function Notes() {
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [allNotes, setAllNotes] = useState([])

  const [body, setBody] = useState('')
  const [context, setContext] = useState('general')
  const [matchId, setMatchId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  // Paginated notes
  const { data: pageData, isFetching, isLoading, error } = useQuery({
    queryKey: ['notes', uid, page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('id, created_at, context, body, match_id')
        .eq('wrestler_id', uid)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  // All matches for the dropdown (no pagination)
  const { data: matches = [] } = useQuery({
    queryKey: ['matches-dropdown', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, opponent_name, match_date')
        .eq('wrestler_id', uid)
        .order('match_date', { ascending: false })
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
      setAllNotes(pageData)
    } else {
      setAllNotes(prev => [...prev, ...pageData])
    }
  }, [pageData]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { error } = await supabase.from('notes').insert({
        wrestler_id: session.user.id,
        body,
        context,
        match_id: matchId || null,
      })
      if (error) throw error
      setBody('')
      setMatchId('')
      setSubmitSuccess(true)
      setPage(0)
      setAllNotes([])
      queryClient.invalidateQueries({ queryKey: ['notes', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const hasMore = pageData?.length === PAGE_SIZE
  const filtered = filter === 'all' ? allNotes : allNotes.filter(n => n.context === filter)

  if (isLoading && page === 0) {
    return <div className="font-mono text-[#444] text-xs tracking-[0.3em]">LOADING...</div>
  }

  if (error) {
    return (
      <div className="font-mono text-red-400 text-sm border border-red-900/50 bg-red-950/20 px-3 py-2">
        Failed to load notes: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">NOTES</h1>

      {/* Form */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">NEW NOTE</div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>CONTEXT</label>
              <select
                value={context}
                onChange={e => setContext(e.target.value)}
                className={inputClass}
              >
                {CONTEXTS.map(c => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>LINKED MATCH (OPTIONAL)</label>
              <select
                value={matchId}
                onChange={e => setMatchId(e.target.value)}
                className={inputClass}
              >
                <option value="">— None —</option>
                {matches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.opponent_name} ·{' '}
                    {new Date(m.match_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>NOTE</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              rows={4}
              className={`${inputClass} resize-none`}
              placeholder="What did you work on? What needs improvement?"
            />
          </div>
          {submitError && (
            <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className="text-[11px] font-mono text-green-500">Note saved.</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-2.5 bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] hover:bg-[#b45309] transition-colors disabled:opacity-40"
          >
            {submitting ? 'SAVING...' : 'SAVE NOTE'}
          </button>
        </form>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-display tracking-[0.15em] text-[#444]">FILTER:</span>
        {['all', ...CONTEXTS].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-[10px] font-display tracking-[0.12em] border transition-colors ${
              filter === f
                ? 'border-[#d97706] text-[#d97706]'
                : 'border-[#1e1e1e] text-[#444] hover:border-[#2a2a2a] hover:text-[#aaa]'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div className="font-mono text-xs text-[#333] py-2">No notes yet.</div>
      ) : (
        <div className="space-y-px">
          {filtered.map(note => (
            <div key={note.id} className="border border-[#1a1a1a] bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`text-[10px] font-display tracking-[0.12em] border px-2 py-0.5 ${
                    CONTEXT_STYLE[note.context] ?? CONTEXT_STYLE.general
                  }`}
                >
                  {note.context.toUpperCase()}
                </span>
                <span className="font-mono text-[10px] text-[#3a3a3a]">
                  {new Date(note.created_at)
                    .toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    .toUpperCase()}
                </span>
              </div>
              <p className="font-mono text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">
                {note.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={isFetching}
            className="px-6 py-2 border border-[#1e1e1e] font-display text-[10px] tracking-[0.18em] text-[#555] hover:border-[#d97706] hover:text-[#d97706] transition-colors disabled:opacity-40"
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
