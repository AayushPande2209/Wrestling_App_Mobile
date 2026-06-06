import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch,
} from 'react-native'
import { supabase } from '../../lib/supabase'

export default function Profile() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [weightClass, setWeightClass] = useState('')
  const [showOnBoard, setShowOnBoard] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data, error } = await supabase.from('wrestlers').select('email, name, weight_class, show_on_board').eq('id', session.user.id).single()
      if (error) throw error
      setEmail(data.email ?? '')
      setName(data.name ?? '')
      setWeightClass(data.weight_class != null ? String(data.weight_class) : '')
      setShowOnBoard(data.show_on_board ?? false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    setSubmitError(null)
    setSubmitSuccess(false)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { error } = await supabase.from('wrestlers').update({
        name: name.trim() || null,
        weight_class: weightClass ? parseInt(weightClass) : null,
        show_on_board: showOnBoard,
      }).eq('id', session.user.id)
      if (error) throw error
      setSubmitSuccess(true)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <View style={s.center}><Text style={s.loading}>LOADING...</Text></View>
  }

  if (error) {
    return <View style={s.center}><Text style={s.errorText}>{error}</Text></View>
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>PROFILE</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>WRESTLER INFO</Text>

        <Text style={s.fieldLabel}>EMAIL</Text>
        <TextInput value={email} editable={false} style={[s.input, s.inputDisabled]} />

        <Text style={s.fieldLabel}>NAME</Text>
        <TextInput value={name} onChangeText={setName} style={s.input} placeholder="Your name" placeholderTextColor="#2a2a2a" />

        <Text style={s.fieldLabel}>WEIGHT CLASS (LBS)</Text>
        <TextInput
          value={weightClass}
          onChangeText={setWeightClass}
          style={s.input}
          keyboardType="numeric"
          placeholder="152"
          placeholderTextColor="#2a2a2a"
        />
        <Text style={s.hint}>Required for cut analysis on the dashboard.</Text>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>SHOW ON TEAM BOARD</Text>
            <Text style={s.toggleHint}>Share your weight and record with teammates.</Text>
          </View>
          <Switch
            value={showOnBoard}
            onValueChange={setShowOnBoard}
            trackColor={{ false: '#1e1e1e', true: '#d97706' }}
            thumbColor="#f0f0f0"
          />
        </View>

        {submitError && (
          <View style={s.errorBox}>
            <Text style={s.errorBoxText}>{submitError}</Text>
          </View>
        )}
        {submitSuccess && (
          <Text style={s.successText}>Profile saved.</Text>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={[s.btn, submitting && s.btnDisabled]}
        >
          <Text style={s.btnText}>{submitting ? 'SAVING...' : 'SAVE'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' },
  loading: { fontSize: 11, color: '#888', letterSpacing: 6, fontFamily: 'monospace' },
  errorText: { fontSize: 12, color: '#f87171', fontFamily: 'monospace' },
  pageTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: '#f0f0f0', fontFamily: 'monospace' },
  card: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 16, gap: 8 },
  cardTitle: { fontSize: 10, letterSpacing: 4, color: '#d97706', fontFamily: 'monospace', marginBottom: 8 },
  fieldLabel: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginTop: 6 },
  input: { backgroundColor: '#060606', borderWidth: 1, borderColor: '#1e1e1e', color: '#f0f0f0', fontFamily: 'monospace', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  inputDisabled: { opacity: 0.4 },
  hint: { fontSize: 10, color: '#333', fontFamily: 'monospace', marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, marginTop: 4 },
  toggleLabel: { fontSize: 10, letterSpacing: 3, color: '#aaa', fontFamily: 'monospace' },
  toggleHint: { fontSize: 10, color: '#333', fontFamily: 'monospace', marginTop: 2 },
  errorBox: { borderWidth: 1, borderColor: 'rgba(220,38,38,0.5)', backgroundColor: 'rgba(69,10,10,0.2)', padding: 10 },
  errorBoxText: { fontSize: 11, color: '#f87171', fontFamily: 'monospace' },
  successText: { fontSize: 11, color: '#22c55e', fontFamily: 'monospace' },
  btn: { backgroundColor: '#d97706', paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 10, letterSpacing: 6, color: '#0a0a0a', fontWeight: 'bold', fontFamily: 'monospace' },
})
