import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated'
import { supabase } from '../../lib/supabase'
import CoachOnboarding from '../../components/CoachOnboarding'
import WeightClassPicker from '../../components/WeightClassPicker'

const { height: SCREEN_H } = Dimensions.get('window')

function SummaryRow({ label, value }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  )
}

export default function Profile() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [weightClass, setWeightClass] = useState(null)
  const [showOnBoard, setShowOnBoard] = useState(false)
  const [coachProfile, setCoachProfile] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [editingCoachProfile, setEditingCoachProfile] = useState(false)
  const [coachProfileSaved, setCoachProfileSaved] = useState(false)

  const slideY = useSharedValue(SCREEN_H)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }))

  useEffect(() => { loadProfile() }, [])

  useEffect(() => {
    if (editingCoachProfile) {
      slideY.value = SCREEN_H
      slideY.value = withTiming(0, { duration: 300 })
    }
  }, [editingCoachProfile])

  async function loadProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data, error } = await supabase.from('wrestlers')
        .select('email, name, weight_class, show_on_board, coach_profile')
        .eq('id', session.user.id)
        .single()
      if (error) throw error
      setEmail(data.email ?? '')
      setName(data.name ?? '')
      setWeightClass(data.weight_class ?? null)
      setShowOnBoard(data.show_on_board ?? false)
      setCoachProfile(data.coach_profile ?? null)
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
        weight_class: weightClass ?? null,
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

  const closeModal = () => {
    slideY.value = withTiming(SCREEN_H, { duration: 300 }, (done) => {
      if (done) runOnJS(setEditingCoachProfile)(false)
    })
  }

  const handleCoachProfileUpdate = async (updatedProfile) => {
    const now = new Date().toISOString()
    const profile = {
      ...updatedProfile,
      completed_at: coachProfile?.completed_at ?? now,
      edited_at: now,
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.from('wrestlers').update({ coach_profile: profile }).eq('id', session.user.id)
      }
    } catch { /* state is updated regardless; DB failure is non-blocking */ }
    setCoachProfile(profile)
    closeModal()
    setCoachProfileSaved(true)
    setTimeout(() => setCoachProfileSaved(false), 3000)
  }

  if (loading) {
    return <View style={s.center}><Text style={s.loading}>LOADING...</Text></View>
  }

  if (error) {
    return <View style={s.center}><Text style={s.errorText}>{error}</Text></View>
  }

  const isEditMode = coachProfile !== null

  return (
    <View style={s.root}>
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>PROFILE</Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>WRESTLER INFO</Text>

          <Text style={s.fieldLabel}>EMAIL</Text>
          <TextInput value={email} editable={false} style={[s.input, s.inputDisabled]} />

          <Text style={s.fieldLabel}>NAME</Text>
          <TextInput value={name} onChangeText={setName} style={s.input} placeholder="Your name" placeholderTextColor="#2a2a2a" />

          <Text style={s.fieldLabel}>WEIGHT CLASS</Text>
          <WeightClassPicker
            value={weightClass}
            onChange={setWeightClass}
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

        {/* Coach Profile section */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>COACH PROFILE</Text>
          {isEditMode && (
            <TouchableOpacity onPress={() => setEditingCoachProfile(true)} activeOpacity={0.7}>
              <Text style={s.editLink}>EDIT →</Text>
            </TouchableOpacity>
          )}
        </View>

        {coachProfile !== null ? (
          <View style={s.summaryCard}>
            <SummaryRow label="WEIGHT CLASS" value={`${coachProfile.weight_class} lbs`} />
            <SummaryRow label="START CUT" value={coachProfile.cut_start} />
            <SummaryRow label="SAME-DAY CUT" value={`${coachProfile.same_day_cut} lbs`} />
            {Array.isArray(coachProfile.cut_method) && (
              <SummaryRow label="CUT METHODS" value={coachProfile.cut_method.join(', ')} />
            )}
            <SummaryRow label="SCHOOL LUNCH" value={coachProfile.school_lunch} />
            <SummaryRow label="RECOVERY TIME" value={coachProfile.recovery_time} />
            {coachProfile.notes ? (
              <SummaryRow label="NOTES" value={coachProfile.notes} />
            ) : null}
          </View>
        ) : (
          <View style={s.summaryCard}>
            <Text style={s.emptyText}>Coach profile not set up yet.</Text>
            <TouchableOpacity onPress={() => setEditingCoachProfile(true)} activeOpacity={0.7}>
              <Text style={s.editLink}>SET UP NOW →</Text>
            </TouchableOpacity>
          </View>
        )}

        {coachProfileSaved && (
          <Text style={[s.successText, { paddingHorizontal: 0 }]}>Coach profile updated.</Text>
        )}
      </ScrollView>

      {editingCoachProfile && (
        <Animated.View style={[s.modalOverlay, animStyle]}>
          <CoachOnboarding
            initialAnswers={isEditMode ? coachProfile : null}
            editMode={isEditMode}
            onComplete={handleCoachProfileUpdate}
            onCancel={closeModal}
            applyTopInset={false}
            skipDbWrite={true}
          />
        </Animated.View>
      )}
    </View>
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
  // Coach Profile section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 9, color: '#555', letterSpacing: 4, fontFamily: 'monospace' },
  editLink: { fontSize: 9, color: '#e8712a', letterSpacing: 2, fontFamily: 'monospace' },
  summaryCard: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 12, gap: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#1a1a1a' },
  summaryLabel: { fontSize: 9, color: '#555', letterSpacing: 2, fontFamily: 'monospace' },
  summaryValue: { fontSize: 10, color: '#ccc', fontFamily: 'monospace', flex: 1, textAlign: 'right', paddingLeft: 8 },
  emptyText: { fontSize: 11, color: '#555', fontFamily: 'monospace', marginBottom: 8 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a', zIndex: 100 },
})
