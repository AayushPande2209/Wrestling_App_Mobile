import { useState, useEffect } from 'react'
import {
  View, TextInput, TouchableOpacity, Switch, Dimensions, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated'
import { supabase } from '../../lib/supabase'
import CoachOnboarding from '../../components/CoachOnboarding'
import WeightClassPicker from '../../components/WeightClassPicker'
import Screen from '../../components/ui/Screen'
import ScreenHeader from '../../components/ui/ScreenHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import TextField from '../../components/ui/TextField'
import ListRow from '../../components/ui/ListRow'
import AppText from '../../components/ui/AppText'
import { colors, spacing } from '../../constants/theme'

const { height: SCREEN_H } = Dimensions.get('window')

function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="footnote" color={colors.textSecondary}>{label}</AppText>
      <AppText variant="footnote" style={styles.summaryValue}>{value}</AppText>
    </View>
  )
}

export default function Profile() {
  const router = useRouter()
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

  async function handleSignOut() {
    await supabase.auth.signOut()
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
    } catch { /* non-blocking */ }
    setCoachProfile(profile)
    closeModal()
    setCoachProfileSaved(true)
    setTimeout(() => setCoachProfileSaved(false), 3000)
  }

  const isEditMode = coachProfile !== null

  return (
    <View style={styles.root}>
      <Screen scroll loading={loading} error={error} contentStyle={{ paddingTop: spacing.md }}>
        <ScreenHeader title="Profile" showBack onBack={() => router.back()} />

        <Card>
          <AppText variant="headline" style={{ marginBottom: spacing.sm }}>Wrestler info</AppText>
          <TextField label="Email" value={email} editable={false} style={{ opacity: 0.6 }} />
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <AppText variant="footnote" style={{ marginTop: spacing.sm }}>Weight class</AppText>
          <WeightClassPicker value={weightClass} onChange={setWeightClass} />
          <AppText variant="caption" color={colors.textTertiary}>Required for cut tracking on Today.</AppText>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="body">Show on team board</AppText>
              <AppText variant="footnote" color={colors.textTertiary}>Share weight with teammates.</AppText>
            </View>
            <Switch
              value={showOnBoard}
              onValueChange={setShowOnBoard}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          {submitError ? <AppText variant="footnote" color={colors.error}>{submitError}</AppText> : null}
          {submitSuccess ? <AppText variant="footnote" color={colors.success}>Profile saved.</AppText> : null}
          <Button label={submitting ? 'Saving…' : 'Save'} onPress={handleSubmit} loading={submitting} />
        </Card>

        <Card style={{ paddingVertical: 0, paddingHorizontal: spacing.md }}>
          <ListRow label="Team board" icon="people-outline" onPress={() => router.push('/board')} />
        </Card>

        <View style={styles.sectionHeader}>
          <AppText variant="headline">Coach profile</AppText>
          {isEditMode && (
            <TouchableOpacity onPress={() => setEditingCoachProfile(true)} activeOpacity={0.7}>
              <AppText variant="footnote" color={colors.accent}>Edit</AppText>
            </TouchableOpacity>
          )}
        </View>

        <Card>
          {coachProfile !== null ? (
            <>
              <SummaryRow label="Weight class" value={`${coachProfile.weight_class} lbs`} />
              <SummaryRow label="Start cut" value={coachProfile.cut_start} />
              <SummaryRow label="Same-day cut" value={`${coachProfile.same_day_cut} lbs`} />
              {Array.isArray(coachProfile.cut_method) && (
                <SummaryRow label="Cut methods" value={coachProfile.cut_method.join(', ')} />
              )}
              <SummaryRow label="School lunch" value={coachProfile.school_lunch} />
              <SummaryRow label="Recovery time" value={coachProfile.recovery_time} />
              {coachProfile.notes ? <SummaryRow label="Notes" value={coachProfile.notes} /> : null}
            </>
          ) : (
            <>
              <AppText variant="footnote" color={colors.textTertiary}>Coach profile not set up yet.</AppText>
              <Button label="Set up now" variant="ghost" onPress={() => setEditingCoachProfile(true)} style={{ marginTop: spacing.sm }} />
            </>
          )}
        </Card>

        {coachProfileSaved && (
          <AppText variant="footnote" color={colors.success}>Coach profile updated.</AppText>
        )}

        <Button label="Sign out" variant="destructive" onPress={handleSignOut} />
      </Screen>

      {editingCoachProfile && (
        <Animated.View style={[styles.modalOverlay, animStyle]}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  summaryValue: { flex: 1, textAlign: 'right', paddingLeft: spacing.sm },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, zIndex: 100 },
})
