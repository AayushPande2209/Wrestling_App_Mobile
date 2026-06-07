import { useState, useEffect } from 'react'
import { View, StatusBar, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import CoachOnboarding from '../../components/CoachOnboarding'

export default function CoachOnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function guard() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/(auth)'); return }
      const { data } = await supabase.from('wrestlers').select('coach_profile').eq('id', session.user.id).single()
      if (data?.coach_profile) { router.replace('/(app)/'); return }
      setChecking(false)
    }
    guard()
  }, [])

  if (checking) {
    return (
      <View style={[s.root, s.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#e8712a" size="large" />
      </View>
    )
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <CoachOnboarding onComplete={() => router.replace('/(app)/')} />
    </>
  )
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0a0a0a' },
  center: { justifyContent: 'center', alignItems: 'center' },
})
