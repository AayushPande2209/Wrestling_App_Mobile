import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Dimensions, Keyboard,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import WeightClassPicker, { WEIGHT_CLASSES } from './WeightClassPicker'
import { colors, radii, spacing, MIN_TOUCH } from '../constants/theme'

const { width: SW } = Dimensions.get('window')

const QUESTIONS = [
  {
    key: 'weight_class',
    type: 'weightclass',
    question: 'What weight class are you cutting to this season?',
  },
  {
    key: 'cut_start',
    type: 'select',
    question: 'How far out do you usually start your cut?',
    options: ['Day of weigh-ins', '2–3 days out', '4–5 days out', '1 week or more'],
  },
  {
    key: 'same_day_cut',
    type: 'number',
    question: 'How much do you usually cut the day of weigh-ins?',
    placeholder: '3',
    unit: 'LBS',
  },
  {
    key: 'cut_method',
    type: 'multiselect',
    question: 'How do you cut weight? Select all that apply.',
    options: [
      'Diet / calorie restriction',
      'Sweat / sauna',
      'Water restriction',
      'Spitting',
      'Combination approach',
    ],
  },
  {
    key: 'school_lunch',
    type: 'textarea',
    question: "What's usually available at your school lunch?",
    placeholder: 'pizza, sandwiches, salad bar…',
  },
  {
    key: 'recovery_time',
    type: 'select',
    question: 'After weigh-ins, how long until your first match?',
    options: ['Under 1 hour', '1–2 hours', '2–4 hours', '4 hours or more'],
  },
  {
    key: 'notes',
    type: 'textarea',
    question: 'Anything else your coach should know about how your body cuts?',
    placeholder: 'Optional — skip if nothing comes to mind',
    optional: true,
  },
]

// Saves profile to DB then calls onComplete(profile).
// onComplete is responsible for any navigation or state update.
export default function CoachOnboarding({ onComplete, initialAnswers = null, editMode = false, onCancel = null, applyTopInset = true, skipDbWrite = false }) {
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(initialAnswers ?? {})
  const [textValue, setTextValue] = useState('')
  const [selectedValue, setSelectedValue] = useState(null)
  const [selectedValues, setSelectedValues] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [weightClassIdx, setWeightClassIdx] = useState(() => {
    const val = initialAnswers?.weight_class
    const idx = val != null ? WEIGHT_CLASSES.indexOf(Number(val)) : -1
    return idx >= 0 ? idx : WEIGHT_CLASSES.indexOf(150)
  })

  // Pre-fill inputs for the current question when in edit mode
  useEffect(() => {
    if (!editMode || !initialAnswers) return
    const q = QUESTIONS[step]
    const val = answers[q.key]
    if (q.type === 'weightclass') {
      const idx = val != null ? WEIGHT_CLASSES.indexOf(Number(val)) : -1
      setWeightClassIdx(idx >= 0 ? idx : WEIGHT_CLASSES.indexOf(150))
    } else if (q.type === 'number' || q.type === 'textarea') {
      setTextValue(val != null ? String(val) : '')
    } else if (q.type === 'select') {
      setSelectedValue(val ?? null)
    } else if (q.type === 'multiselect') {
      setSelectedValues(Array.isArray(val) ? [...val] : [])
    }
  }, [step, editMode])

  const slideX = useSharedValue(0)
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }))

  const q = QUESTIONS[step]

  const isAnswerValid = () => {
    if (q.optional) return true
    if (q.type === 'weightclass') return true
    if (q.type === 'number' || q.type === 'textarea') return textValue.trim().length > 0
    if (q.type === 'select') return selectedValue !== null
    if (q.type === 'multiselect') return selectedValues.length > 0
    return false
  }

  const getAnswer = () => {
    if (q.type === 'weightclass') return WEIGHT_CLASSES[weightClassIdx]
    if (q.type === 'number' || q.type === 'textarea') return textValue.trim()
    if (q.type === 'select') return selectedValue ?? ''
    if (q.type === 'multiselect') return [...selectedValues]
    return ''
  }

  const handleNext = (skip = false) => {
    if (saving) return
    Keyboard.dismiss()
    const answer = skip ? (q.type === 'multiselect' ? [] : '') : getAnswer()
    const updated = { ...answers, [q.key]: answer }
    const isLast = step === QUESTIONS.length - 1
    const nextStep = step + 1

    slideX.value = withTiming(-SW, { duration: 200 }, (done) => {
      if (done) runOnJS(afterSlide)(updated, isLast, nextStep)
    })
  }

  const afterSlide = (updated, isLast, nextStep) => {
    setAnswers(updated)
    setTextValue('')
    setSelectedValue(null)
    setSelectedValues([])
    setSaveError(null)

    if (!isLast) {
      setStep(nextStep)
      slideX.value = SW
      slideX.value = withTiming(0, { duration: 200 })
    } else {
      save(updated)
    }
  }

  const save = async (profileData) => {
    setSaving(true)
    try {
      if (!skipDbWrite) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Session expired — sign in again')
        const { error } = await supabase.from('wrestlers')
          .update({ coach_profile: profileData })
          .eq('id', session.user.id)
        if (error) throw error
      }
      onComplete(profileData)
    } catch (err) {
      setSaveError(err.message)
      setSaving(false)
      slideX.value = 0
    }
  }

  if (saving) {
    return (
      <View style={[s.root, s.center, { paddingTop: applyTopInset ? insets.top : 0 }]}>
        <Text style={s.savingText}>SETTING UP...</Text>
      </View>
    )
  }

  const progress = (step + 1) / QUESTIONS.length
  const isLast = step === QUESTIONS.length - 1
  const canAdvance = isAnswerValid()

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Progress bar */}
      <View style={[s.progressSection, { paddingTop: (applyTopInset ? insets.top : 0) + 12 }]}>
        <View style={s.progressRow}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={s.stepLabel}>{step + 1} of {QUESTIONS.length}</Text>
          {editMode && onCancel && (
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.questionBlock, animStyle]}>
          {/* Coach chat bubble */}
          <View style={s.coachRow}>
            <View style={s.coachIconWrap}>
              <Ionicons name="hardware-chip-outline" size={16} color={colors.accent} />
            </View>
            <View style={s.coachBubble}>
              <Text style={s.coachLabel}>Coach</Text>
              <Text style={s.questionText}>{q.question}</Text>
            </View>
          </View>

          {/* Input — varies by question type */}
          <View style={s.inputArea}>
            {q.type === 'weightclass' && (
              <WeightClassPicker
                value={WEIGHT_CLASSES[weightClassIdx]}
                onChange={(cls) => setWeightClassIdx(WEIGHT_CLASSES.indexOf(cls))}
              />
            )}

            {q.type === 'number' && (
              <View style={s.numberRow}>
                <TextInput
                  value={textValue}
                  onChangeText={setTextValue}
                  keyboardType="decimal-pad"
                  style={s.numberInput}
                  placeholder={q.placeholder}
                  placeholderTextColor="#2a2a2a"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => { if (canAdvance) handleNext() }}
                />
                {q.unit && <Text style={s.unit}>{q.unit}</Text>}
              </View>
            )}

            {q.type === 'textarea' && (
              <TextInput
                value={textValue}
                onChangeText={setTextValue}
                style={s.textareaInput}
                placeholder={q.placeholder}
                placeholderTextColor="#2a2a2a"
                multiline
                numberOfLines={3}
                autoFocus={!q.optional}
                textAlignVertical="top"
              />
            )}

            {(q.type === 'select' || q.type === 'multiselect') && (
              <View style={s.optionList}>
                {q.options.map(opt => {
                  const active = q.type === 'select'
                    ? selectedValue === opt
                    : selectedValues.includes(opt)
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => {
                        if (q.type === 'select') {
                          setSelectedValue(active ? null : opt)
                        } else {
                          setSelectedValues(prev =>
                            active ? prev.filter(v => v !== opt) : [...prev, opt]
                          )
                        }
                      }}
                      activeOpacity={0.7}
                      style={[s.option, active && s.optionActive]}
                    >
                      <Text style={[s.optionText, active && s.optionTextActive]}>{opt}</Text>
                      {active && <Ionicons name="checkmark" size={13} color={colors.accent} />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {saveError && <Text style={s.errorText}>{saveError}</Text>}

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          onPress={() => handleNext(false)}
          disabled={!canAdvance}
          activeOpacity={0.7}
          style={[s.nextBtn, !canAdvance && s.nextBtnDisabled]}
        >
          <Text style={s.nextBtnText}>{isLast ? (editMode ? 'Save changes' : 'Finish setup') : 'Next'}</Text>
        </TouchableOpacity>
        {q.optional && (
          <TouchableOpacity onPress={() => handleNext(true)} style={s.skipBtn}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: colors.bg },
  center:           { justifyContent: 'center', alignItems: 'center' },
  savingText:       { fontSize: 15, color: colors.textSecondary },

  progressSection:  { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  progressRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressTrack:    { flex: 1, height: 4, backgroundColor: colors.surfaceElevated, borderRadius: radii.full, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: colors.accent, borderRadius: radii.full },
  stepLabel:        { fontSize: 13, color: colors.textTertiary, minWidth: 48, textAlign: 'right' },
  cancelBtn:        { marginLeft: spacing.sm, padding: 4 },
  cancelBtnText:    { fontSize: 18, color: colors.textSecondary },

  scroll:           { flex: 1 },
  scrollContent:    { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  questionBlock:    { gap: spacing.lg },

  coachRow:         { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  coachIconWrap:    {
    width: 36, height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  coachBubble:      {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: radii.lg,
    borderTopLeftRadius: radii.sm,
    padding: spacing.md,
  },
  coachLabel:       { fontSize: 13, color: colors.accent, marginBottom: 4, fontWeight: '600' },
  questionText:     { fontSize: 17, color: colors.text, lineHeight: 22 },

  inputArea:        { gap: spacing.sm },

  numberRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  numberInput:      {
    flex: 1,
    fontSize: 42,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingVertical: spacing.sm,
    minHeight: 72,
  },
  unit:             { fontSize: 17, color: colors.textSecondary },

  textareaInput:    {
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: radii.sm,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 88,
    textAlignVertical: 'top',
  },

  optionList:       { gap: spacing.sm },
  option:           {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH,
  },
  optionActive:     { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  optionText:       { fontSize: 17, color: colors.textSecondary, flex: 1 },
  optionTextActive: { color: colors.text, fontWeight: '600' },

  errorText:        { fontSize: 15, color: colors.error, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },

  footer:           { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  nextBtn:          { backgroundColor: colors.accent, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: MIN_TOUCH, borderRadius: radii.sm },
  nextBtnDisabled:  { opacity: 0.35 },
  nextBtnText:      { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  skipBtn:          { alignItems: 'center', paddingVertical: spacing.sm, minHeight: MIN_TOUCH, justifyContent: 'center' },
  skipText:         { fontSize: 15, color: colors.textTertiary },
})
