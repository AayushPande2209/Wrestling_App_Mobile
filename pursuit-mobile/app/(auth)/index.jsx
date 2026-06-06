import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

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
          router.replace('/(app)/coach')
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

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Wordmark */}
        <View style={s.wordmark}>
          <Text style={s.title}>PURSUIT</Text>
          <Text style={s.subtitle}>WRESTLER TRAINING SYSTEM</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          {/* Tabs */}
          {mode !== 'forgot' && (
            <View style={s.tabs}>
              {[{ key: 'login', label: 'SIGN IN' }, { key: 'signup', label: 'SIGN UP' }].map(
                ({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => switchMode(key)}
                    style={[s.tab, mode === key && s.tabActive]}
                  >
                    <Text style={[s.tabText, mode === key && s.tabTextActive]}>{label}</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}

          {mode === 'forgot' && (
            <TouchableOpacity onPress={() => switchMode('login')} style={s.backBtn}>
              <Text style={s.backBtnText}>← BACK TO SIGN IN</Text>
            </TouchableOpacity>
          )}

          <View style={s.form}>
            {mode === 'forgot' && (
              <Text style={s.resetLabel}>RESET PASSWORD</Text>
            )}

            <Text style={s.fieldLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={s.input}
              placeholder="wrestler@team.edu"
              placeholderTextColor="#2a2a2a"
            />

            {mode !== 'forgot' && (
              <>
                <Text style={[s.fieldLabel, { marginTop: 16 }]}>PASSWORD</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  style={s.input}
                  placeholderTextColor="#2a2a2a"
                />
              </>
            )}

            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {forgotSent ? (
              <View style={s.successBox}>
                <Text style={s.successText}>Check your email for a reset link.</Text>
              </View>
            ) : signupSent ? (
              <View style={s.successBox}>
                <Text style={s.successText}>Check your email to confirm your account, then sign in.</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={[s.btn, loading && s.btnDisabled]}
              >
                <Text style={s.btnText}>
                  {loading
                    ? 'LOADING...'
                    : mode === 'login'
                    ? 'SIGN IN'
                    : mode === 'signup'
                    ? 'CREATE ACCOUNT'
                    : 'SEND RESET LINK'}
                </Text>
              </TouchableOpacity>
            )}

            {mode === 'login' && !forgotSent && (
              <TouchableOpacity onPress={() => switchMode('forgot')} style={s.forgotBtn}>
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0c0c' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  wordmark: { marginBottom: 40 },
  title: { fontSize: 40, fontWeight: 'bold', letterSpacing: 14, color: '#d97706', fontFamily: 'monospace' },
  subtitle: { fontSize: 10, color: '#333', letterSpacing: 4, marginTop: 6, fontFamily: 'monospace' },
  card: { borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#0a0a0a' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#d97706', marginBottom: -1 },
  tabText: { fontSize: 10, letterSpacing: 4, color: '#888', fontFamily: 'monospace' },
  tabTextActive: { color: '#d97706' },
  backBtn: { paddingHorizontal: 28, paddingTop: 20 },
  backBtnText: { fontSize: 10, color: '#888', letterSpacing: 2, fontFamily: 'monospace' },
  form: { padding: 28 },
  resetLabel: { fontSize: 10, letterSpacing: 4, color: '#d97706', fontFamily: 'monospace', marginBottom: 16 },
  fieldLabel: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginBottom: 8 },
  input: {
    backgroundColor: '#060606',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    color: '#f0f0f0',
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  errorBox: { borderWidth: 1, borderColor: 'rgba(220,38,38,0.5)', backgroundColor: 'rgba(69,10,10,0.2)', padding: 12, marginTop: 12 },
  errorText: { fontSize: 11, color: '#f87171', fontFamily: 'monospace' },
  successBox: { borderWidth: 1, borderColor: 'rgba(22,163,74,0.5)', backgroundColor: 'rgba(5,46,22,0.2)', padding: 12, marginTop: 12 },
  successText: { fontSize: 11, color: '#22c55e', fontFamily: 'monospace' },
  btn: { backgroundColor: '#d97706', marginTop: 16, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 10, letterSpacing: 6, color: '#0a0a0a', fontWeight: 'bold', fontFamily: 'monospace' },
  forgotBtn: { marginTop: 16, alignItems: 'center' },
  forgotText: { fontSize: 10, color: '#333', letterSpacing: 2, fontFamily: 'monospace' },
})
