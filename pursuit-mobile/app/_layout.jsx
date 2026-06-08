import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

const queryClient = new QueryClient()

function AuthGate({ children }) {
  const router = useRouter()
  const segments = useSegments()
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    const inAuth = segments[0] === '(auth)'

    if (!session && !inAuth) {
      router.replace('/(auth)/')
      return
    }

    if (session && inAuth) {
      ;(async () => {
        const { data: wrestler } = await supabase
          .from('wrestlers')
          .select('id, coach_profile')
          .eq('id', session.user.id)
          .single()

        if (!wrestler) {
          await supabase.from('wrestlers').upsert(
            {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name ?? session.user.email,
            },
            { onConflict: 'id', ignoreDuplicates: true }
          )
          router.replace('/(auth)/coach-onboarding')
        } else if (!wrestler.coach_profile) {
          router.replace('/(auth)/coach-onboarding')
        } else {
          router.replace('/(app)/')
        }
      })()
    }
  }, [session, segments])

  return children
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <Slot />
        </AuthGate>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
