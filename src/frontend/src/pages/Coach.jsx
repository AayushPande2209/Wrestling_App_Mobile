import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL

// ─── Onboarding questions ────────────────────────────────────────────────────
const ONBOARDING_QUESTIONS = [
  {
    key: 'weight_class',
    question: 'What weight class are you cutting to this season?',
    placeholder: 'e.g. 152',
  },
  {
    key: 'cut_start',
    question: 'When do you typically start your cut?',
    placeholder: 'e.g. 3 days out, 1 week out',
  },
  {
    key: 'same_day_cut',
    question: 'How much do you usually cut the day of weigh-ins?',
    placeholder: 'e.g. 2–3 lbs',
  },
  {
    key: 'cut_method',
    question: 'How do you cut?',
    placeholder: 'e.g. diet only, sweat/sauna, water restriction, combination',
  },
  {
    key: 'school_lunch',
    question: "What's usually available at your school lunch?",
    placeholder: 'e.g. pizza, sandwiches, salad bar…',
  },
  {
    key: 'notes',
    question: 'Anything else I should know about how your body cuts weight?',
    placeholder: 'Optional — skip if nothing comes to mind',
    optional: true,
  },
]

// ─── Status bar at top of chat ───────────────────────────────────────────────
function StatusBar({ wrestler, nextEvent }) {
  const rawCut =
    wrestler?.current_weight != null && wrestler?.weight_class != null
      ? wrestler.current_weight - wrestler.weight_class
      : null
  const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null
  const onWeight = rawCut !== null && rawCut <= 0

  let daysOut = null
  if (nextEvent?.starts_at) {
    const diff = Math.ceil(
      (new Date(nextEvent.starts_at) - new Date()) / 86_400_000
    )
    daysOut = Math.max(0, diff)
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-[#1f1f1f] bg-[#111] shrink-0 overflow-x-auto">
      {wrestler?.current_weight != null && (
        <Chip label="CURRENT" value={`${wrestler.current_weight} LBS`} />
      )}
      {lbsToCut !== null && (
        <Chip
          label="TO CUT"
          value={onWeight ? 'ON WEIGHT' : `${lbsToCut.toFixed(1)} LBS`}
          highlight={!onWeight && lbsToCut > 0}
          green={onWeight}
        />
      )}
      {daysOut !== null && (
        <Chip
          label="NEXT EVENT"
          value={daysOut === 0 ? 'TODAY' : `${daysOut}D`}
          highlight={daysOut <= 3 && daysOut > 0}
        />
      )}
    </div>
  )
}

function Chip({ label, value, highlight, green }) {
  return (
    <div className="shrink-0">
      <div className="text-[8px] font-display tracking-[0.18em] text-[#555]">{label}</div>
      <div
        className={`font-mono text-[11px] font-bold ${
          green ? 'text-[#22c55e]' : highlight ? 'text-[#e8712a]' : 'text-[#aaa]'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

// ─── Individual chat message ─────────────────────────────────────────────────
function Message({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4`}>
      <div
        className={`max-w-[82%] md:max-w-[70%] px-4 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[#111] border border-[#e8712a]/40 text-[#f0f0f0] rounded-sm'
            : 'bg-[#0d0d0d] border border-[#1f1f1f] text-[#ccc] rounded-sm'
        }`}
      >
        {!isUser && (
          <div className="text-[9px] font-display tracking-[0.2em] text-[#e8712a] mb-1.5">
            COACH
          </div>
        )}
        {content}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Coach() {
  const [wrestler, setWrestler] = useState(null)
  const [nextEvent, setNextEvent] = useState(null)
  const [coachProfile, setCoachProfile] = useState(undefined) // undefined = loading
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)

  // Onboarding state
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [onboardingInput, setOnboardingInput] = useState('')
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [onboardingError, setOnboardingError] = useState(null)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const onboardingInputRef = useRef(null)

  // ── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const uid = session.user.id
      const now = new Date().toISOString()

      const [
        { data: wrestlerData },
        { data: historyData },
        { data: eventData },
      ] = await Promise.all([
        supabase
          .from('wrestlers')
          .select('name, current_weight, weight_class, coach_profile')
          .eq('id', uid)
          .single(),
        supabase
          .from('coach_messages')
          .select('role, content, created_at')
          .eq('wrestler_id', uid)
          .order('created_at', { ascending: true })
          .limit(40),
        supabase
          .from('schedules')
          .select('title, starts_at')
          .eq('wrestler_id', uid)
          .gt('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(1),
      ])

      setWrestler(wrestlerData)
      setCoachProfile(wrestlerData?.coach_profile ?? null)
      setMessages(historyData ?? [])
      setNextEvent(eventData?.[0] ?? null)
      setInitialLoading(false)
    }
    load()
  }, [])

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus onboarding input when step changes
  useEffect(() => {
    if (coachProfile === null) {
      setTimeout(() => onboardingInputRef.current?.focus(), 50)
    }
  }, [step, coachProfile])

  // ── Shared fetch helper (auth + JSON) ────────────────────────────────────
  async function postCoach(payload) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const res = await fetch(`${API_URL}/coach/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(err.detail || 'Request failed')
    }
    return res.json()
  }

  // ── Onboarding: advance to next question ─────────────────────────────────
  async function handleOnboardingNext(e) {
    e.preventDefault()
    const q = ONBOARDING_QUESTIONS[step]
    const value = onboardingInput.trim()

    // Optional questions can be skipped
    if (!value && !q.optional) return

    const updated = { ...answers, [q.key]: value }
    setAnswers(updated)
    setOnboardingInput('')

    const isLast = step === ONBOARDING_QUESTIONS.length - 1
    if (!isLast) {
      setStep(s => s + 1)
      return
    }

    // Last question answered — submit onboarding
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

  function handleOnboardingSkip() {
    // Only the last optional question can be skipped
    const updated = { ...answers, notes: '' }
    setAnswers(updated)
    setOnboardingInput('')
    setStep(ONBOARDING_QUESTIONS.length - 1)
    // Trigger submit immediately
    handleOnboardingSubmit(updated)
  }

  async function handleOnboardingSubmit(finalAnswers) {
    setOnboardingLoading(true)
    setOnboardingError(null)
    try {
      const data = await postCoach({ message: 'Onboarding complete', onboarding: finalAnswers })
      setCoachProfile(finalAnswers)
      setMessages([{ role: 'assistant', content: data.response }])
    } catch (err) {
      setOnboardingError(err.message)
    } finally {
      setOnboardingLoading(false)
    }
  }

  // ── Chat: send message ────────────────────────────────────────────────────
  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setSendError(null)
    // Optimistically add user message so the UI feels instant
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setSending(true)

    try {
      const data = await postCoach({ message: text })
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      setSendError(err.message)
      // Remove the optimistic message on error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Render: loading ───────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="font-mono text-[#888] text-xs tracking-[0.3em]">LOADING...</div>
    )
  }

  // ── Render: onboarding ────────────────────────────────────────────────────
  if (coachProfile === null) {
    const q = ONBOARDING_QUESTIONS[step]
    const totalSteps = ONBOARDING_QUESTIONS.length
    const isLast = step === totalSteps - 1

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <div className="text-[10px] font-display tracking-[0.25em] text-[#e8712a] mb-1">
              WEIGHT CUT COACH
            </div>
            <h1 className="font-display font-bold text-2xl tracking-[0.15em] text-[#f0f0f0]">
              Let's set up your profile
            </h1>
            <p className="font-mono text-[11px] text-[#555] mt-1">
              {step + 1} of {totalSteps}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5 mb-8">
            {ONBOARDING_QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={`h-0.5 flex-1 transition-colors ${
                  i <= step ? 'bg-[#e8712a]' : 'bg-[#1f1f1f]'
                }`}
              />
            ))}
          </div>

          {/* Question */}
          <div className="mb-6">
            <p className="font-display font-semibold text-lg text-[#f0f0f0] tracking-wide leading-snug">
              {q.question}
            </p>
          </div>

          {/* Input form */}
          <form onSubmit={handleOnboardingNext} className="space-y-3">
            <input
              ref={onboardingInputRef}
              type="text"
              value={onboardingInput}
              onChange={e => setOnboardingInput(e.target.value)}
              placeholder={q.placeholder}
              className="w-full bg-[#0d0d0d] border border-[#1f1f1f] text-[#f0f0f0] font-mono text-sm px-4 py-3 outline-none focus:border-[#e8712a] transition-colors placeholder-[#333] min-h-[44px]"
            />

            {onboardingError && (
              <p className="font-mono text-[11px] text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2">
                {onboardingError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={onboardingLoading || (!onboardingInput.trim() && !q.optional)}
                className="flex-1 py-3 bg-[#e8712a] text-[#0d0d0d] font-display font-bold text-[10px] tracking-[0.25em] hover:bg-[#d4621f] transition-colors disabled:opacity-40"
              >
                {onboardingLoading
                  ? 'SETTING UP...'
                  : isLast
                  ? 'FINISH SETUP'
                  : 'NEXT →'}
              </button>
              {isLast && q.optional && !onboardingLoading && (
                <button
                  type="button"
                  onClick={handleOnboardingSkip}
                  className="font-mono text-[10px] text-[#555] hover:text-[#888] tracking-[0.1em] transition-colors whitespace-nowrap"
                >
                  Skip
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Render: chat ─────────────────────────────────────────────────────────
  return (
    // Offset the Layout's padding so the chat fills the full available height
    <div className="flex flex-col -mx-4 md:-mx-8 -mt-8 h-[calc(100vh-3rem)] md:h-screen">

      {/* Page title row */}
      <div className="px-4 md:px-8 pt-6 pb-3 shrink-0">
        <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">
          COACH
        </h1>
        <p className="font-mono text-[10px] text-[#555] mt-0.5">
          AI weight cut coach — knows your logs, matches, and schedule
        </p>
      </div>

      {/* Status bar */}
      <StatusBar wrestler={wrestler} nextEvent={nextEvent} />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="px-4 font-mono text-xs text-[#333]">
            Ask anything about your cut, nutrition, or how to feel ready on match day.
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} role={msg.role} content={msg.content} />
        ))}
        {sending && (
          <div className="flex justify-start px-4">
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] px-4 py-3 font-mono text-sm text-[#555] rounded-sm">
              <div className="text-[9px] font-display tracking-[0.2em] text-[#e8712a] mb-1.5">
                COACH
              </div>
              <span className="animate-pulse">thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {sendError && (
        <div className="mx-4 mb-2 font-mono text-[11px] text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2 shrink-0">
          {sendError} — try again
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="shrink-0 flex gap-2 px-4 md:px-8 py-3 border-t border-[#1f1f1f] bg-[#0d0d0d]"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask your coach…"
          disabled={sending}
          className="flex-1 bg-[#111] border border-[#1f1f1f] text-[#f0f0f0] font-mono text-sm px-4 py-2.5 outline-none focus:border-[#e8712a] transition-colors placeholder-[#333] disabled:opacity-50 min-h-[44px]"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-5 py-2.5 bg-[#e8712a] text-[#0d0d0d] font-display font-bold text-[10px] tracking-[0.2em] hover:bg-[#d4621f] transition-colors disabled:opacity-40 shrink-0 min-h-[44px]"
        >
          SEND
        </button>
      </form>
    </div>
  )
}
