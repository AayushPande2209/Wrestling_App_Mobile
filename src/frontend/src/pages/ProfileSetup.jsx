import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a] min-h-[44px]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#aaa] mb-2'

export default function ProfileSetup() {
  const [name, setName] = useState('')
  const [weightClass, setWeightClass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // If wrestler already has a real name (not equal to their email), skip to dashboard
  useEffect(() => {
    async function checkProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/auth', { replace: true }); return }
      const { data } = await supabase
        .from('wrestlers')
        .select('name, email')
        .eq('id', session.user.id)
        .single()
      if (data?.name && data.name !== data.email) {
        navigate('/dashboard', { replace: true })
      }
    }
    checkProfile()
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/auth', { replace: true }); return }
      const updates = { name: name.trim() }
      if (weightClass) updates.weight_class = parseInt(weightClass)
      const { error } = await supabase
        .from('wrestlers')
        .update(updates)
        .eq('id', session.user.id)
      if (error) throw error
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-10">
          <h1 className="font-display font-bold text-5xl tracking-[0.3em] text-[#d97706]">
            PURSUIT
          </h1>
          <p className="font-mono text-[10px] text-[#333] tracking-[0.3em] mt-1.5">
            WRESTLER TRAINING SYSTEM
          </p>
        </div>

        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-7">
          <div className="font-display font-bold text-lg tracking-[0.15em] text-[#f0f0f0] mb-1">
            Set up your profile
          </div>
          <p className="font-mono text-[10px] text-[#888] tracking-[0.08em] mb-6">
            You can update this any time from your profile page.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>NAME</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                placeholder="Your name"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>WEIGHT CLASS (LBS) — OPTIONAL</label>
              <input
                type="number"
                value={weightClass}
                onChange={e => setWeightClass(e.target.value)}
                min="50"
                max="400"
                inputMode="numeric"
                placeholder="152"
                className={inputClass}
              />
              <p className="text-[10px] font-mono text-[#333] mt-1.5">
                Used for cut analysis on the dashboard.
              </p>
            </div>

            {error && (
              <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] py-3 mt-1 hover:bg-[#b45309] transition-colors disabled:opacity-40 min-h-[44px]"
            >
              {loading ? 'SAVING...' : 'GET STARTED'}
            </button>
          </form>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={handleSkip}
              className="font-mono text-[10px] text-[#333] hover:text-[#888] tracking-[0.1em] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
