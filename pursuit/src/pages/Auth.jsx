import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          await supabase.from('wrestlers').insert({ id: data.user.id, email, name: null })
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
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

        {/* Card */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          {/* Tabs */}
          <div className="flex border-b border-[#1a1a1a]">
            {[
              { key: 'login', label: 'SIGN IN' },
              { key: 'signup', label: 'SIGN UP' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setMode(key); setError(null) }}
                className={`flex-1 py-3 text-[10px] tracking-[0.2em] font-display font-medium transition-colors ${
                  mode === key
                    ? 'text-[#d97706] border-b-2 border-[#d97706] -mb-px'
                    : 'text-[#444] hover:text-[#aaa]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-7 space-y-4">
            <div>
              <label className="block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a]"
                placeholder="wrestler@team.edu"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
              className="w-full bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] py-3 mt-1 hover:bg-[#b45309] transition-colors disabled:opacity-40"
            >
              {loading ? 'LOADING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
