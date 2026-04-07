import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase processes the URL hash from the emailed link and fires PASSWORD_RECOVERY
    // when the temporary session is established and the user can set a new password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">
            SET NEW PASSWORD
          </div>

          {!ready ? (
            <p className="font-mono text-xs text-[#888] tracking-[0.1em]">Verifying reset link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] tracking-[0.15em] font-display text-[#aaa] mb-2">
                  NEW PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors"
                />
              </div>

              {error && (
                <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] py-3 hover:bg-[#b45309] transition-colors disabled:opacity-40"
              >
                {loading ? 'SAVING...' : 'SET PASSWORD'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
