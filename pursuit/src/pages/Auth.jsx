import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [signupSent, setSignupSent] = useState(false)
  const navigate = useNavigate()

  function switchMode(next) {
    setMode(next)
    setError(null)
    setForgotSent(false)
    setSignupSent(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // Supabase returns a fake success for existing emails to prevent enumeration;
        // identities is empty when the email is already registered.
        if (data.user?.identities?.length === 0) {
          throw new Error('An account with this email already exists. Try signing in instead.')
        }
        // If email confirmation is disabled (e.g. local dev), session is
        // available immediately — navigate directly to profile setup.
        // If confirmation is required, show a message and let the user
        // confirm their email; ProtectedRoute will redirect to /profile/setup
        // after they sign in for the first time.
        if (data.session) {
          if (data.user) {
            await supabase.from('wrestlers').insert({ id: data.user.id, email, name: email })
          }
          navigate('/profile/setup')
        } else {
          // Confirmation email sent — insert wrestler row optimistically so
          // it exists when they land after confirming. Use upsert to avoid
          // duplicate key errors if the row was already created.
          if (data.user) {
            await supabase.from('wrestlers').upsert({ id: data.user.id, email, name: email }, { onConflict: 'id', ignoreDuplicates: true })
          }
          setSignupSent(true)
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setForgotSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/dashboard')
      }
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
          {/* Tabs — hidden in forgot mode */}
          {mode !== 'forgot' && (
            <div className="flex border-b border-[#1a1a1a]">
              {[
                { key: 'login', label: 'SIGN IN' },
                { key: 'signup', label: 'SIGN UP' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => switchMode(key)}
                  className={`flex-1 py-3 text-[10px] tracking-[0.2em] font-display font-medium transition-colors ${
                    mode === key
                      ? 'text-[#d97706] border-b-2 border-[#d97706] -mb-px'
                      : 'text-[#888] hover:text-[#aaa]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Forgot password header */}
          {mode === 'forgot' && (
            <div className="flex items-center gap-3 px-7 pt-6 pb-0">
              <button
                onClick={() => switchMode('login')}
                className="font-mono text-[10px] text-[#888] hover:text-[#aaa] tracking-[0.1em] transition-colors"
              >
                ← BACK TO SIGN IN
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-7 space-y-4">
            {mode === 'forgot' && (
              <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706]">
                RESET PASSWORD
              </div>
            )}

            <div>
              <label className="block text-[10px] tracking-[0.15em] font-display text-[#aaa] mb-2">
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

            {mode !== 'forgot' && (
              <div>
                <label className="block text-[10px] tracking-[0.15em] font-display text-[#aaa] mb-2">
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
            )}

            {error && (
              <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
                {error}
              </p>
            )}

            {forgotSent ? (
              <p className="text-[11px] font-mono text-green-500 border border-green-900/50 bg-green-950/20 px-3 py-2">
                Check your email for a reset link.
              </p>
            ) : signupSent ? (
              <p className="text-[11px] font-mono text-green-500 border border-green-900/50 bg-green-950/20 px-3 py-2">
                Check your email to confirm your account, then sign in.
              </p>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] py-3 mt-1 hover:bg-[#b45309] transition-colors disabled:opacity-40"
              >
                {loading
                  ? 'LOADING...'
                  : mode === 'login'
                  ? 'SIGN IN'
                  : mode === 'signup'
                  ? 'CREATE ACCOUNT'
                  : 'SEND RESET LINK'}
              </button>
            )}

            {/* Forgot password link — only shown on sign-in tab */}
            {mode === 'login' && !forgotSent && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="font-mono text-[10px] text-[#333] hover:text-[#888] tracking-[0.1em] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
