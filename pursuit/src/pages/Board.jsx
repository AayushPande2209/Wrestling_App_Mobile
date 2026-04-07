import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export default function Board() {
  const [uid, setUid] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  const { data: wrestlers = [], isLoading, error } = useQuery({
    queryKey: ['board'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wrestlers')
        .select('id, name, current_weight, weight_class')
        .eq('show_on_board', true)
        .order('weight_class', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  if (isLoading) return <div className="font-mono text-[#444] text-xs tracking-[0.3em]">LOADING...</div>
  if (error) return (
    <div className="font-mono text-red-400 text-sm border border-red-900/50 bg-red-950/20 px-3 py-2">
      Failed to load board: {error.message}
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">TEAM BOARD</h1>
        <p className="font-mono text-[10px] text-[#444] mt-1 tracking-[0.1em]">
          Wrestlers who opted in via Profile → Show on Team Board
        </p>
      </div>

      {wrestlers.length === 0 ? (
        <p className="font-mono text-xs text-[#333]">
          No wrestlers have opted in yet. Enable "Show on Team Board" in your Profile to appear here.
        </p>
      ) : (
        <div className="border border-[#1a1a1a]">
          {/* Header */}
          <div className="grid grid-cols-4 px-5 py-3 border-b border-[#1a1a1a] bg-[#080808]">
            {['WRESTLER', 'CLASS', 'CURRENT WEIGHT', 'TO CUT'].map(h => (
              <div key={h} className="text-[10px] font-display tracking-[0.15em] text-[#444]">{h}</div>
            ))}
          </div>
          {wrestlers.map(w => {
            const rawCut = w.current_weight != null && w.weight_class != null
              ? w.current_weight - w.weight_class
              : null
            const onWeight = rawCut !== null && rawCut <= 0
            const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null
            const highlight = lbsToCut !== null && !onWeight && lbsToCut > 5

            return (
              <div
                key={w.id}
                className="grid grid-cols-4 px-5 py-3.5 border-b border-[#111] hover:bg-[#0d0d0d] transition-colors"
              >
                <div className="font-mono text-sm text-[#ccc]">{w.name && !w.name.includes('@') ? w.name : '—'}</div>
                <div className="font-mono text-sm text-[#555]">
                  {w.weight_class != null ? `${w.weight_class} LBS` : '—'}
                </div>
                <div className="font-mono text-sm text-[#ccc]">
                  {w.current_weight != null ? `${w.current_weight} LBS` : '—'}
                </div>
                <div className={`font-mono text-sm font-bold ${highlight ? 'text-[#d97706]' : 'text-[#555]'}`}>
                  {lbsToCut !== null
                    ? (onWeight ? 'ON WEIGHT' : `${lbsToCut.toFixed(1)} LBS`)
                    : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
