import { useState } from 'react'
import {
  View, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '../../lib/supabase'
import AppText from '../../components/ui/AppText'
import TextField from '../../components/ui/TextField'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import SegmentedControl from '../../components/ui/SegmentedControl'
import { colors, spacing, radii } from '../../constants/theme'

WebBrowser.maybeCompleteAuthSession()

const AUTH_TABS = [
  { value: 'login', label: 'Sign in' },
  { value: 'signup', label: 'Sign up' },
]

export default function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [signupSent, setSignupSent] = useState(false)
  const router = useRouter()

  function switchMode(next) {
    setMode(next)
    setError(null)
    setForgotSent(false)
    setSignupSent(false)
  }

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user?.identities?.length === 0) {
          throw new Error('An account with this email already exists. Try signing in instead.')
        }
        if (data.session) {
          if (data.user) {
            await supabase.from('wrestlers').insert({ id: data.user.id, email, name: email })
          }
          router.replace('/(auth)/coach-onboarding')
        } else {
          if (data.user) {
            await supabase.from('wrestlers').upsert(
              { id: data.user.id, email, name: email },
              { onConflict: 'id', ignoreDuplicates: true }
            )
          }
          setSignupSent(true)
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'pursuit://reset-password',
        })
        if (error) throw error
        setForgotSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace('/(app)')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      const redirectUrl = makeRedirectUri({ scheme: 'pursuit', path: 'auth/callback' })
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      })
      if (error) throw error

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
      if (result.type === 'success') {
        const url = new URL(result.url)
        const errorParam = url.searchParams.get('error')
        if (errorParam) throw new Error(
          errorParam === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in failed: ${errorParam}`
        )
        const code = url.searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        }
      }
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.wordmark}>
          <AppText variant="largeTitle" color={colors.accent}>Pursuit</AppText>
          <AppText variant="footnote" color={colors.textTertiary}>Wrestler training system</AppText>
        </View>

        <Card>
          {mode !== 'forgot' && (
            <SegmentedControl
              options={AUTH_TABS}
              value={mode}
              onChange={switchMode}
            />
          )}

          {mode === 'forgot' && (
            <TouchableOpacity onPress={() => switchMode('login')} style={styles.backBtn}>
              <AppText variant="footnote" color={colors.accent}>← Back to sign in</AppText>
            </TouchableOpacity>
          )}

          {mode !== 'forgot' && (
            <View style={styles.oauthSection}>
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={loading}
                style={[styles.googleBtn, loading && styles.btnDisabled]}
                activeOpacity={0.7}
              >
                <Image source={require('../../assets/google-icon.png')} style={{ width: 18, height: 18 }} />
                <AppText variant="body">Continue with Google</AppText>
              </TouchableOpacity>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <AppText variant="caption" color={colors.textTertiary}>or</AppText>
                <View style={styles.dividerLine} />
              </View>
            </View>
          )}

          <View style={styles.form}>
            {mode === 'forgot' && (
              <AppText variant="headline" style={{ marginBottom: spacing.sm }}>Reset password</AppText>
            )}

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="wrestler@team.edu"
            />

            {mode !== 'forgot' && (
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                style={{ marginTop: spacing.sm }}
              />
            )}

            {error && (
              <View style={styles.errorBox}>
                <AppText variant="footnote" color={colors.error}>{error}</AppText>
              </View>
            )}

            {forgotSent ? (
              <View style={styles.successBox}>
                <AppText variant="footnote" color={colors.success}>Check your email for a reset link.</AppText>
              </View>
            ) : signupSent ? (
              <View style={styles.successBox}>
                <AppText variant="footnote" color={colors.success}>Check your email to confirm your account, then sign in.</AppText>
              </View>
            ) : (
              <Button
                label={
                  loading
                    ? 'Loading…'
                    : mode === 'login'
                    ? 'Sign in'
                    : mode === 'signup'
                    ? 'Create account'
                    : 'Send reset link'
                }
                onPress={handleSubmit}
                loading={loading}
                style={{ marginTop: spacing.md }}
              />
            )}

            {mode === 'login' && !forgotSent && (
              <TouchableOpacity onPress={() => switchMode('forgot')} style={styles.forgotBtn}>
                <AppText variant="footnote" color={colors.textTertiary}>Forgot password?</AppText>
              </TouchableOpacity>
            )}
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  wordmark: { marginBottom: spacing.xl, gap: 4 },
  backBtn: { marginBottom: spacing.sm },
  form: { marginTop: spacing.md, gap: spacing.sm },
  oauthSection: { marginTop: spacing.md },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: radii.sm,
    padding: spacing.md,
    minHeight: 44,
  },
  btnDisabled: { opacity: 0.45 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.error,
    backgroundColor: colors.errorMuted,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  successBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.success,
    backgroundColor: colors.successMuted,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  forgotBtn: { marginTop: spacing.md, alignItems: 'center' },
})
