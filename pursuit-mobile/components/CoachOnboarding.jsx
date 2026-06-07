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

const { width: SW } = Dimensions.get('window')

const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#1f1f1f',
  orange: '#e8712a',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
}

const QUESTIONS = [
  {
    key: 'weight_class',
    type: 'number',
    question: 'What weight class are you cutting to this season?',
    placeholder: '152',
    unit: 'LBS',
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

  // Pre-fill inputs for the current question when in edit mode
  useEffect(() => {
    if (!editMode || !initialAnswers) return
    const q = QUESTIONS[step]
    const val = answers[q.key]
    if (q.type === 'number' || q.type === 'textarea') {
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
    if (q.type === 'number' || q.type === 'textarea') return textValue.trim().length > 0
    if (q.type === 'select') return selectedValue !== null
    if (q.type === 'multiselect') return selectedValues.length > 0
    return false
  }

  const getAnswer = () => {
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
              <Ionicons name="hardware-chip-outline" size={16} color={C.orange} />
            </View>
            <View style={s.coachBubble}>
              <Text style={s.coachLabel}>COACH</Text>
              <Text style={s.questionText}>{q.question}</Text>
            </View>
          </View>

          {/* Input — varies by question type */}
          <View style={s.inputArea}>
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
                      {active && <Ionicons name="checkmark" size={13} color={C.orange} />}
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
          <Text style={s.nextBtnText}>{isLast ? (editMode ? 'SAVE CHANGES' : 'FINISH SETUP') : 'NEXT →'}</Text>
        </TouchableOpacity>
        {q.optional && (
          <TouchableOpacity onPress={() => handleNext(true)} style={s.skipBtn}>
            <Text style={s.skipText}>SKIP →</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: C.bg },
  center:           { justifyContent: 'center', alignItems: 'center' },
  savingText:       { fontSize: 11, letterSpacing: 6, color: C.textDim, fontFamily: 'monospace' },

  progressSection:  { paddingHorizontal: 20, paddingBottom: 8 },
  progressRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack:    { flex: 1, height: 3, backgroundColor: '#1f1f1f', borderRadius: 2, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: C.orange, borderRadius: 2 },
  stepLabel:        { fontSize: 9, letterSpacing: 2, color: C.textDim, fontFamily: 'monospace', minWidth: 48, textAlign: 'right' },
  cancelBtn:        { marginLeft: 12, padding: 4 },
  cancelBtnText:    { fontSize: 14, color: C.textDim, fontFamily: 'monospace' },

  scroll:           { flex: 1 },
  scrollContent:    { padding: 20, paddingTop: 16, paddingBottom: 8 },
  questionBlock:    { gap: 24 },

  coachRow:         { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  coachIconWrap:    {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: '#2a1a06',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  coachBubble:      {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: '#1f1f1f',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    padding: 14,
  },
  coachLabel:       { fontSize: 9, letterSpacing: 5, color: C.orange, fontFamily: 'monospace', marginBottom: 6 },
  questionText:     { fontSize: 15, color: C.text, fontFamily: 'monospace', lineHeight: 22 },

  inputArea:        { gap: 8 },

  numberRow:        { flexDirection: 'row', alignItems: 'center', gap: 16 },
  numberInput:      {
    flex: 1,
    fontSize: 42,
    fontWeight: 'bold',
    color: C.orange,
    fontFamily: 'monospace',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: C.orange,
    paddingVertical: 8,
    minHeight: 72,
  },
  unit:             { fontSize: 13, color: C.textMuted, fontFamily: 'monospace' },

  textareaInput:    {
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: '#222',
    color: C.text,
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 88,
    textAlignVertical: 'top',
  },

  optionList:       { gap: 8 },
  option:           {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: '#1f1f1f',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  optionActive:     { borderColor: C.orange, backgroundColor: '#1e1208' },
  optionText:       { fontSize: 13, color: C.textDim, fontFamily: 'monospace' },
  optionTextActive: { color: C.orange },

  errorText:        { fontSize: 11, color: '#f87171', fontFamily: 'monospace', paddingHorizontal: 20, marginBottom: 8 },

  footer:           { paddingHorizontal: 20, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#141414' },
  nextBtn:          { backgroundColor: C.orange, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  nextBtnDisabled:  { opacity: 0.35 },
  nextBtnText:      { fontSize: 11, fontWeight: 'bold', letterSpacing: 6, color: C.bg, fontFamily: 'monospace' },
  skipBtn:          { alignItems: 'center', paddingVertical: 8 },
  skipText:         { fontSize: 10, color: C.textDim, fontFamily: 'monospace', letterSpacing: 3 },
})
