import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

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
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.inner}>
        <Text style={s.title}>PURSUIT</Text>
        <Text style={s.subtitle}>WRESTLER TRAINING SYSTEM</Text>

        <View style={s.card}>
          <Text style={s.cardLabel}>SET NEW PASSWORD</Text>
          {!ready ? (
            <Text style={s.waiting}>Verifying reset link...</Text>
          ) : (
            <>
              <Text style={s.fieldLabel}>NEW PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                style={s.input}
                placeholderTextColor="#2a2a2a"
              />
              {error && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={[s.btn, loading && s.btnDisabled]}
              >
                <Text style={s.btnText}>{loading ? 'SAVING...' : 'SET PASSWORD'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0c0c' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  title: { fontSize: 40, fontWeight: 'bold', letterSpacing: 14, color: '#d97706', fontFamily: 'monospace', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#333', letterSpacing: 4, fontFamily: 'monospace', marginBottom: 40 },
  card: { borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#0a0a0a', padding: 28 },
  cardLabel: { fontSize: 10, letterSpacing: 4, color: '#d97706', fontFamily: 'monospace', marginBottom: 20 },
  waiting: { fontSize: 11, color: '#888', fontFamily: 'monospace', letterSpacing: 2 },
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
  btn: { backgroundColor: '#d97706', marginTop: 16, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 10, letterSpacing: 6, color: '#0a0a0a', fontWeight: 'bold', fontFamily: 'monospace' },
})
