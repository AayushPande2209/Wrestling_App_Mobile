import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { supabase } from '../../lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL

const ONBOARDING_QUESTIONS = [
  { key: 'weight_class', question: 'What weight class are you cutting to this season?', placeholder: 'e.g. 152' },
  { key: 'cut_start', question: 'When do you typically start your cut?', placeholder: 'e.g. 3 days out, 1 week out' },
  { key: 'same_day_cut', question: 'How much do you usually cut the day of weigh-ins?', placeholder: 'e.g. 2–3 lbs' },
  { key: 'cut_method', question: 'How do you cut?', placeholder: 'e.g. diet only, sweat/sauna, water restriction, combination' },
  { key: 'school_lunch', question: "What's usually available at your school lunch?", placeholder: 'e.g. pizza, sandwiches, salad bar…' },
  { key: 'notes', question: 'Anything else I should know about how your body cuts weight?', placeholder: 'Optional — skip if nothing comes to mind', optional: true },
]

function StatusChip({ label, value, highlight, green }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipLabel}>{label}</Text>
      <Text style={[s.chipValue, green ? { color: '#22c55e' } : highlight ? { color: '#e8712a' } : { color: '#aaa' }]}>
        {value}
      </Text>
    </View>
  )
}

function Message({ role, content }) {
  const isUser = role === 'user'
  return (
    <View style={[s.msgContainer, isUser ? s.msgRight : s.msgLeft]}>
      <View style={[s.msgBubble, isUser ? s.msgBubbleUser : s.msgBubbleCoach]}>
        {!isUser && <Text style={s.coachLabel}>COACH</Text>}
        <Text style={s.msgText}>{content}</Text>
      </View>
    </View>
  )
}

export default function Coach() {
  const [wrestler, setWrestler] = useState(null)
  const [nextEvent, setNextEvent] = useState(null)
  const [coachProfile, setCoachProfile] = useState(undefined)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [onboardingInput, setOnboardingInput] = useState('')
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [onboardingError, setOnboardingError] = useState(null)

  const scrollRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      const now = new Date().toISOString()
      const [{ data: wrestlerData }, { data: historyData }, { data: eventData }] = await Promise.all([
        supabase.from('wrestlers').select('name, current_weight, weight_class, coach_profile').eq('id', uid).single(),
        supabase.from('coach_messages').select('role, content, created_at').eq('wrestler_id', uid).order('created_at', { ascending: true }).limit(40),
        supabase.from('schedules').select('title, starts_at').eq('wrestler_id', uid).gt('starts_at', now).order('starts_at', { ascending: true }).limit(1),
      ])
      setWrestler(wrestlerData)
      setCoachProfile(wrestlerData?.coach_profile ?? null)
      setMessages(historyData ?? [])
      setNextEvent(eventData?.[0] ?? null)
      setInitialLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages])

  async function postCoach(payload) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const res = await fetch(`${API_URL}/coach/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(err.detail || 'Request failed')
    }
    return res.json()
  }

  async function handleOnboardingNext() {
    const q = ONBOARDING_QUESTIONS[step]
    const value = onboardingInput.trim()
    if (!value && !q.optional) return
    const updated = { ...answers, [q.key]: value }
    setAnswers(updated)
    setOnboardingInput('')
    const isLast = step === ONBOARDING_QUESTIONS.length - 1
    if (!isLast) { setStep(s => s + 1); return }
    setOnboardingLoading(true)
    setOnboardingError(null)
    try {
      const data = await postCoach({ message: 'Onboarding complete', onboarding: updated })
      setCoachProfile(updated)
      setMessages([{ role: 'assistant', content: data.response }])
    } catch (err) {
      setOnboardingError(err.message)
    } finally {
      setOnboardingLoading(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSendError(null)
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setSending(true)
    try {
      const data = await postCoach({ message: text })
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      setSendError(err.message)
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  const rawCut = wrestler?.current_weight != null && wrestler?.weight_class != null
    ? wrestler.current_weight - wrestler.weight_class : null
  const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null
  const onWeight = rawCut !== null && rawCut <= 0
  let daysOut = null
  if (nextEvent?.starts_at) {
    daysOut = Math.max(0, Math.ceil((new Date(nextEvent.starts_at) - new Date()) / 86_400_000))
  }

  if (initialLoading) {
    return <View style={s.center}><Text style={s.loading}>LOADING...</Text></View>
  }

  // Onboarding
  if (coachProfile === null) {
    const q = ONBOARDING_QUESTIONS[step]
    const isLast = step === ONBOARDING_QUESTIONS.length - 1
    return (
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.onboardContent}>
          <Text style={s.onboardSubtitle}>WEIGHT CUT COACH</Text>
          <Text style={s.onboardTitle}>Let's set up your profile</Text>
          <Text style={s.onboardStep}>{step + 1} of {ONBOARDING_QUESTIONS.length}</Text>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            {ONBOARDING_QUESTIONS.map((_, i) => (
              <View key={i} style={[s.progressDot, i <= step && s.progressDotActive]} />
            ))}
          </View>

          <Text style={s.onboardQuestion}>{q.question}</Text>

          <TextInput
            value={onboardingInput}
            onChangeText={setOnboardingInput}
            style={s.onboardInput}
            placeholder={q.placeholder}
            placeholderTextColor="#333"
            autoFocus
          />
          {onboardingError && <Text style={s.errorText}>{onboardingError}</Text>}
          <TouchableOpacity
            onPress={handleOnboardingNext}
            disabled={onboardingLoading || (!onboardingInput.trim() && !q.optional)}
            style={[s.onboardBtn, (onboardingLoading || (!onboardingInput.trim() && !q.optional)) && s.btnDisabled]}
          >
            <Text style={s.onboardBtnText}>
              {onboardingLoading ? 'SETTING UP...' : isLast ? 'FINISH SETUP' : 'NEXT →'}
            </Text>
          </TouchableOpacity>
          {isLast && q.optional && !onboardingLoading && (
            <TouchableOpacity onPress={() => { setOnboardingInput(''); handleOnboardingNext() }} style={s.skipBtn}>
              <Text style={s.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // Chat
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={s.chatHeader}>
        <Text style={s.chatTitle}>COACH</Text>
        <Text style={s.chatSubtitle}>AI weight cut coach — knows your logs, matches, and schedule</Text>
      </View>

      {/* Status bar */}
      <View style={s.statusBar}>
        {wrestler?.current_weight != null && (
          <StatusChip label="CURRENT" value={`${wrestler.current_weight} LBS`} />
        )}
        {lbsToCut !== null && (
          <StatusChip label="TO CUT" value={onWeight ? 'ON WEIGHT' : `${lbsToCut.toFixed(1)} LBS`} highlight={!onWeight && lbsToCut > 0} green={onWeight} />
        )}
        {daysOut !== null && (
          <StatusChip label="NEXT EVENT" value={daysOut === 0 ? 'TODAY' : `${daysOut}D`} highlight={daysOut <= 3 && daysOut > 0} />
        )}
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={s.messagesContent}>
        {messages.length === 0 && (
          <Text style={s.emptyMsg}>Ask anything about your cut, nutrition, or how to feel ready on match day.</Text>
        )}
        {messages.map((msg, i) => (
          <Message key={i} role={msg.role} content={msg.content} />
        ))}
        {sending && (
          <View style={s.msgLeft}>
            <View style={s.msgBubbleCoach}>
              <Text style={s.coachLabel}>COACH</Text>
              <Text style={s.thinkingText}>thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {sendError && (
        <View style={s.errorBanner}>
          <Text style={s.errorBannerText}>{sendError} — try again</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={s.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          style={s.chatInput}
          placeholder="Ask your coach…"
          placeholderTextColor="#333"
          editable={!sending}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={[s.sendBtn, (!input.trim() || sending) && s.btnDisabled]}
        >
          <Text style={s.sendBtnText}>SEND</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' },
  loading: { fontSize: 11, color: '#888', letterSpacing: 6, fontFamily: 'monospace' },
  // Onboarding
  onboardContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  onboardSubtitle: { fontSize: 10, letterSpacing: 6, color: '#e8712a', fontFamily: 'monospace', marginBottom: 6 },
  onboardTitle: { fontSize: 22, fontWeight: 'bold', color: '#f0f0f0', fontFamily: 'monospace', letterSpacing: 2 },
  onboardStep: { fontSize: 11, color: '#555', fontFamily: 'monospace', marginTop: 4, marginBottom: 20 },
  progressTrack: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressDot: { flex: 1, height: 2, backgroundColor: '#1f1f1f' },
  progressDotActive: { backgroundColor: '#e8712a' },
  onboardQuestion: { fontSize: 16, fontWeight: '600', color: '#f0f0f0', fontFamily: 'monospace', lineHeight: 22, marginBottom: 16 },
  onboardInput: { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1f1f1f', color: '#f0f0f0', fontFamily: 'monospace', fontSize: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  onboardBtn: { backgroundColor: '#e8712a', marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  onboardBtnText: { fontSize: 10, letterSpacing: 6, color: '#0d0d0d', fontWeight: 'bold', fontFamily: 'monospace' },
  skipBtn: { marginTop: 12, alignItems: 'center' },
  skipText: { fontSize: 10, color: '#555', fontFamily: 'monospace', letterSpacing: 2 },
  errorText: { fontSize: 11, color: '#f87171', fontFamily: 'monospace', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  // Chat
  chatHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  chatTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: '#f0f0f0', fontFamily: 'monospace' },
  chatSubtitle: { fontSize: 10, color: '#555', fontFamily: 'monospace', marginTop: 2 },
  statusBar: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1f1f1f', backgroundColor: '#111' },
  chip: {},
  chipLabel: { fontSize: 8, letterSpacing: 4, color: '#555', fontFamily: 'monospace' },
  chipValue: { fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' },
  messages: { flex: 1 },
  messagesContent: { padding: 12, gap: 10 },
  emptyMsg: { fontSize: 12, color: '#333', fontFamily: 'monospace', padding: 8 },
  msgContainer: { paddingHorizontal: 4 },
  msgRight: { alignItems: 'flex-end' },
  msgLeft: { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 2 },
  msgBubbleUser: { backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(232,113,42,0.4)' },
  msgBubbleCoach: { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1f1f1f' },
  coachLabel: { fontSize: 9, letterSpacing: 5, color: '#e8712a', fontFamily: 'monospace', marginBottom: 6 },
  msgText: { fontSize: 13, color: '#f0f0f0', fontFamily: 'monospace', lineHeight: 19 },
  thinkingText: { fontSize: 13, color: '#555', fontFamily: 'monospace' },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(220,38,38,0.5)', backgroundColor: 'rgba(69,10,10,0.2)', padding: 10 },
  errorBannerText: { fontSize: 11, color: '#f87171', fontFamily: 'monospace' },
  inputBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1f1f1f', backgroundColor: '#0d0d0d' },
  chatInput: { flex: 1, backgroundColor: '#111', borderWidth: 1, borderColor: '#1f1f1f', color: '#f0f0f0', fontFamily: 'monospace', fontSize: 13, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  sendBtn: { backgroundColor: '#e8712a', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  sendBtnText: { fontSize: 10, letterSpacing: 4, color: '#0d0d0d', fontWeight: 'bold', fontFamily: 'monospace' },
})
