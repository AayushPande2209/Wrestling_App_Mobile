import { useState, useEffect } from 'react'
import {
  View, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import AppText from '../../components/ui/AppText'
import TextField from '../../components/ui/TextField'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { colors, spacing } from '../../constants/theme'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      router.replace('/(app)')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.wordmark}>
          <AppText variant="largeTitle" color={colors.accent}>Pursuit</AppText>
          <AppText variant="footnote" color={colors.textTertiary}>Wrestler training system</AppText>
        </View>

        <Card>
          <AppText variant="headline" style={{ marginBottom: spacing.md }}>Set new password</AppText>
          {!ready ? (
            <AppText variant="footnote" color={colors.textSecondary}>Verifying reset link…</AppText>
          ) : (
            <>
              <TextField
                label="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
              />
              {error && (
                <AppText variant="footnote" color={colors.error} style={{ marginTop: spacing.sm }}>{error}</AppText>
              )}
              <Button
                label={loading ? 'Saving…' : 'Set password'}
                onPress={handleSubmit}
                loading={loading}
                style={{ marginTop: spacing.md }}
              />
            </>
          )}
        </Card>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  wordmark: { marginBottom: spacing.xl, gap: 4 },
})
