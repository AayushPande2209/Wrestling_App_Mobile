import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a] min-h-[44px]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2'

export default function Profile() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [weightClass, setWeightClass] = useState('')
  const [showOnBoard, setShowOnBoard] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data, error } = await supabase
        .from('wrestlers')
        .select('email, name, weight_class, show_on_board')
        .eq('id', session.user.id)
        .single()
      if (error) throw error
      setEmail(data.email ?? '')
      setName(data.name ?? '')
      setWeightClass(data.weight_class != null ? String(data.weight_class) : '')
      setShowOnBoard(data.show_on_board ?? false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { error } = await supabase
        .from('wrestlers')
        .update({
          name: name.trim() || null,
          weight_class: weightClass ? parseInt(weightClass) : null,
          show_on_board: showOnBoard,
        })
        .eq('id', session.user.id)
      if (error) throw error
      setSubmitSuccess(true)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="font-mono text-[#444] text-xs tracking-[0.3em]">LOADING...</div>
  if (error) return <div className="font-mono text-red-400 text-sm">{error}</div>

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">PROFILE</h1>

      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6 max-w-md">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">
          WRESTLER INFO
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>EMAIL</label>
            <input
              type="text"
              value={email}
              readOnly
              className={`${inputClass} opacity-40 cursor-default`}
            />
          </div>
          <div>
            <label className={labelClass}>NAME</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputClass}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className={labelClass}>WEIGHT CLASS (LBS)</label>
            <input
              type="number"
              value={weightClass}
              onChange={e => setWeightClass(e.target.value)}
              min="50"
              max="400"
              inputMode="numeric"
              className={inputClass}
              placeholder="152"
            />
            <p className="text-[10px] font-mono text-[#333] mt-1.5">
              Required for cut analysis on the dashboard.
            </p>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showOnBoard}
                  onChange={e => setShowOnBoard(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors ${showOnBoard ? 'bg-[#d97706]' : 'bg-[#1e1e1e]'}`} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[#f0f0f0] transition-transform ${showOnBoard ? 'translate-x-4' : ''}`} />
              </div>
              <div>
                <div className="text-[10px] tracking-[0.15em] font-display text-[#555]">SHOW ON TEAM BOARD</div>
                <div className="text-[10px] font-mono text-[#333] mt-0.5">
                  Share your weight and record on the /board page and teammate activity feed.
                </div>
              </div>
            </label>
          </div>
          {submitError && (
            <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className="text-[11px] font-mono text-green-500">Profile saved.</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full md:w-auto px-8 py-2.5 bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] hover:bg-[#b45309] transition-colors disabled:opacity-40 min-h-[44px]"
          >
            {submitting ? 'SAVING...' : 'SAVE'}
          </button>
        </form>
      </div>
    </div>
  )
}
