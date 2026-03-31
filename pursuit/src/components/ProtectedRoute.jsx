import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
        <span className="font-mono text-[#4a4a4a] text-xs tracking-[0.3em]">LOADING...</span>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return children
}
