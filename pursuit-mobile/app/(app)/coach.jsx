import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import CoachOnboarding from '../../components/CoachOnboarding'

const API_URL = process.env.EXPO_PUBLIC_API_URL


function Message({ role, content }) {
  const isUser = role === 'user'
  return (
    <View style={[s.msgContainer, isUser ? s.msgRight : s.msgLeft]}>
      <View style={[s.msgBubble, isUser ? s.msgBubbleUser : s.msgBubbleCoach]}>
        {!isUser && <Text style={s.coachLabel}>Coach</Text>}
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

  const handleOnboardingComplete = async (profile) => {
    const cutStartPhrases = {
      'Day of weigh-ins': 'cutting the day of weigh-ins',
      '2–3 days out': 'starting 2–3 days out',
      '4–5 days out': 'starting 4–5 days out',
      '1 week or more': 'starting a week or more out',
    }
    const cutStartPhrase = cutStartPhrases[profile.cut_start] ?? String(profile.cut_start).toLowerCase()
    const welcomeContent = `Got it — I've got everything I need. You're cutting to ${profile.weight_class} lbs, you're typically ${cutStartPhrase}, and your same-day cut is around ${profile.same_day_cut} lbs. I'll build your plan around that. What do you want to work on first?`
    setMessages([{ role: 'assistant', content: welcomeContent }])
    setCoachProfile(profile)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.from('coach_messages').insert({
          wrestler_id: session.user.id,
          role: 'assistant',
          content: welcomeContent,
        })
      }
    } catch { /* welcome message is in state; DB failure is non-blocking */ }
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

  const onWeight = wrestler?.current_weight != null && wrestler?.weight_class != null
    && wrestler.current_weight <= wrestler.weight_class
  let daysOut = null
  if (nextEvent?.starts_at) {
    daysOut = Math.max(0, Math.ceil((new Date(nextEvent.starts_at) - new Date()) / 86_400_000))
  }

  if (initialLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#FF6B2C" size="large" />
      </View>
    )
  }

  if (coachProfile === null) {
    return <CoachOnboarding onComplete={handleOnboardingComplete} applyTopInset={false} />
  }

  // Chat
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Phase badge */}
      {(() => {
        let label, color, bg
        if (onWeight) {
          label = 'On weight'; color = '#30D158'; bg = 'rgba(48, 209, 88, 0.15)'
        } else if (daysOut === null) {
          return null
        } else if (daysOut === 0) {
          label = 'Same-day cut'; color = '#FF453A'; bg = 'rgba(255, 69, 58, 0.15)'
        } else {
          label = 'Lead-up phase'; color = '#FF6B2C'; bg = 'rgba(255, 107, 44, 0.15)'
        }
        return (
          <View style={[s.phaseBadge, { backgroundColor: bg }]}>
            <Text style={[s.phaseBadgeText, { color }]}>{label}</Text>
          </View>
        )
      })()}

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
              <Text style={s.coachLabel}>Coach</Text>
              <Text style={s.thinkingText}>Thinking…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {sendError && (
        <View style={s.errorBanner}>
          <Text style={s.errorBannerText}>{sendError} — try again</Text>
        </View>
      )}

      <Text style={s.disclaimer}>Not medical advice. Consult a doctor or certified athletic trainer.</Text>

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
          <Text style={s.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  btnDisabled: { opacity: 0.4 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  emptyMsg: { fontSize: 15, color: '#636366', padding: 8 },
  msgContainer: { paddingHorizontal: 4 },
  msgRight: { alignItems: 'flex-end' },
  msgLeft: { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  msgBubbleUser: { backgroundColor: '#2C2C2E' },
  msgBubbleCoach: { backgroundColor: '#1C1C1E', borderWidth: StyleSheet.hairlineWidth, borderColor: '#38383A' },
  coachLabel: { fontSize: 12, color: '#FF6B2C', marginBottom: 4, fontWeight: '600' },
  msgText: { fontSize: 17, color: '#FFFFFF', lineHeight: 22 },
  thinkingText: { fontSize: 17, color: '#8E8E93' },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#FF453A', backgroundColor: 'rgba(255, 69, 58, 0.15)', padding: 12, borderRadius: 12 },
  errorBannerText: { fontSize: 15, color: '#FF453A' },
  phaseBadge: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#38383A' },
  phaseBadgeText: { fontSize: 13, fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#8E8E93', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 16 },
  inputBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#38383A', backgroundColor: '#000000' },
  chatInput: { flex: 1, backgroundColor: '#1C1C1E', borderWidth: StyleSheet.hairlineWidth, borderColor: '#38383A', color: '#FFFFFF', fontSize: 17, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, borderRadius: 20 },
  sendBtn: { backgroundColor: '#FF6B2C', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 20 },
  sendBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
})
