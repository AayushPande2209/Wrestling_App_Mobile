import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const EVENT_TYPES = ['practice', 'tournament', 'dual meet', 'other']

const TYPE_COLOR = {
  practice: 'text-blue-400',
  tournament: 'text-[#d97706]',
  'dual meet': 'text-green-400',
  other: 'text-[#555]',
}

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a]'
const labelClass = 'block text-[10px] tracking-[0.15em] font-display text-[#555] mb-2'

function EventRow({ event, muted }) {
  return (
    <div
      className={`flex items-start gap-6 px-5 py-4 border-b border-[#111] transition-colors ${
        muted ? 'opacity-35' : 'hover:bg-[#0d0d0d]'
      }`}
    >
      <div className="w-24 shrink-0">
        <div className="font-mono text-[11px] text-[#555]">
          {new Date(event.starts_at)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            .toUpperCase()}
        </div>
        <div className="font-mono text-[10px] text-[#333] mt-0.5">
          {new Date(event.starts_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-medium text-sm text-[#f0f0f0] tracking-wide">
          {event.title}
        </div>
        {event.location && (
          <div className="font-mono text-[11px] text-[#444] mt-0.5">{event.location}</div>
        )}
      </div>
      <div className={`text-[10px] font-display tracking-[0.12em] shrink-0 ${TYPE_COLOR[event.event_type] ?? TYPE_COLOR.other}`}>
        {event.event_type.toUpperCase()}
      </div>
    </div>
  )
}

export default function Schedule() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState('practice')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('wrestler_id', session.user.id)
        .order('starts_at', { ascending: true })
      if (error) throw error
      setEvents(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.from('schedules').insert({
        wrestler_id: session.user.id,
        title,
        event_type: eventType,
        starts_at: startsAt,
        ends_at: endsAt || null,
        location: location || null,
      })
      if (error) throw error
      setTitle('')
      setStartsAt('')
      setEndsAt('')
      setLocation('')
      await loadEvents()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="font-mono text-[#444] text-xs tracking-[0.3em]">LOADING...</div>
  if (error) return <div className="font-mono text-red-400 text-sm">{error}</div>

  const now = new Date()
  const upcoming = events.filter(e => new Date(e.starts_at) > now)
  const past = [...events.filter(e => new Date(e.starts_at) <= now)].reverse()

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">SCHEDULE</h1>

      {/* Form */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">ADD EVENT</div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>TITLE</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className={inputClass}
                placeholder="Regional Qualifier"
              />
            </div>
            <div>
              <label className={labelClass}>TYPE</label>
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                className={inputClass}
              >
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>START TIME</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>END TIME (OPTIONAL)</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>LOCATION (OPTIONAL)</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                className={inputClass}
                placeholder="Fieldhouse B"
              />
            </div>
          </div>
          <div className="mt-4">
            {submitError && (
              <p className="text-[11px] font-mono text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2 mb-3">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-2.5 bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] hover:bg-[#b45309] transition-colors disabled:opacity-40"
            >
              {submitting ? 'SAVING...' : 'ADD EVENT'}
            </button>
          </div>
        </form>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-3">
            UPCOMING — {upcoming.length}
          </div>
          <div className="border border-[#1a1a1a]">
            {upcoming.map(e => <EventRow key={e.id} event={e} muted={false} />)}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <div className="text-[10px] font-display tracking-[0.15em] text-[#444] mb-3">
            PAST — {past.length}
          </div>
          <div className="border border-[#1a1a1a]">
            {past.map(e => <EventRow key={e.id} event={e} muted={true} />)}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <p className="font-mono text-xs text-[#333]">No events scheduled yet.</p>
      )}
    </div>
  )
}
