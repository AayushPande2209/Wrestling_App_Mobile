import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20
const EVENT_TYPES = ['practice', 'tournament', 'dual meet', 'other']

const TYPE_COLOR = {
  practice: 'text-blue-400',
  tournament: 'text-[#d97706]',
  'dual meet': 'text-green-400',
  other: 'text-[#555]',
}

const inputClass =
  'w-full bg-[#060606] border border-[#1e1e1e] text-[#f0f0f0] font-mono text-sm px-3 py-2.5 outline-none focus:border-[#d97706] transition-colors placeholder-[#2a2a2a] min-h-[44px]'
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
  const queryClient = useQueryClient()
  const [uid, setUid] = useState(null)
  // Captured once at mount — stable boundary between upcoming and past
  const [nowIso] = useState(() => new Date().toISOString())

  const [upcomingPage, setUpcomingPage] = useState(0)
  const [pastPage, setPastPage] = useState(0)
  const [allUpcoming, setAllUpcoming] = useState([])
  const [allPast, setAllPast] = useState([])

  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState('practice')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  // Upcoming events (paginated, ascending)
  const {
    data: upcomingPage_data,
    isFetching: upcomingFetching,
    isLoading: upcomingLoading,
    error: upcomingError,
  } = useQuery({
    queryKey: ['schedules-upcoming', uid, upcomingPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, title, event_type, starts_at, ends_at, location')
        .eq('wrestler_id', uid)
        .gt('starts_at', nowIso)
        .order('starts_at', { ascending: true })
        .range(upcomingPage * PAGE_SIZE, upcomingPage * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  // Past events (paginated, descending)
  const {
    data: pastPage_data,
    isFetching: pastFetching,
    isLoading: pastLoading,
    error: pastError,
  } = useQuery({
    queryKey: ['schedules-past', uid, pastPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, title, event_type, starts_at, ends_at, location')
        .eq('wrestler_id', uid)
        .lte('starts_at', nowIso)
        .order('starts_at', { ascending: false })
        .range(pastPage * PAGE_SIZE, pastPage * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  // Accumulate upcoming pages
  useEffect(() => {
    if (!upcomingPage_data) return
    if (upcomingPage === 0) {
      setAllUpcoming(upcomingPage_data)
    } else {
      setAllUpcoming(prev => [...prev, ...upcomingPage_data])
    }
  }, [upcomingPage_data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Accumulate past pages
  useEffect(() => {
    if (!pastPage_data) return
    if (pastPage === 0) {
      setAllPast(pastPage_data)
    } else {
      setAllPast(prev => [...prev, ...pastPage_data])
    }
  }, [pastPage_data]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    if (endsAt && endsAt <= startsAt) {
      setSubmitError('End time must be after start time.')
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
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
      setUpcomingPage(0)
      setPastPage(0)
      setAllUpcoming([])
      setAllPast([])
      queryClient.invalidateQueries({ queryKey: ['schedules-upcoming', uid] })
      queryClient.invalidateQueries({ queryKey: ['schedules-past', uid] })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const hasMoreUpcoming = upcomingPage_data?.length === PAGE_SIZE
  const hasMorePast = pastPage_data?.length === PAGE_SIZE
  const initialLoading = (upcomingLoading || pastLoading) && upcomingPage === 0 && pastPage === 0

  if (initialLoading) {
    return <div className="font-mono text-[#444] text-xs tracking-[0.3em]">LOADING...</div>
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl tracking-[0.2em] text-[#f0f0f0]">SCHEDULE</h1>

      {/* Form */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:p-6">
        <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-5">ADD EVENT</div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
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
              className="w-full md:w-auto px-8 py-2.5 bg-[#d97706] text-[#0a0a0a] font-display font-bold text-[10px] tracking-[0.25em] hover:bg-[#b45309] transition-colors disabled:opacity-40 min-h-[44px]"
            >
              {submitting ? 'SAVING...' : 'ADD EVENT'}
            </button>
          </div>
        </form>
      </div>

      {/* Upcoming */}
      {(allUpcoming.length > 0 || upcomingError) && (
        <div>
          <div className="text-[10px] font-display tracking-[0.15em] text-[#d97706] mb-3">
            UPCOMING — {allUpcoming.length}{hasMoreUpcoming ? '+' : ''}
          </div>
          {upcomingError ? (
            <p className="font-mono text-red-400 text-sm border border-red-900/50 bg-red-950/20 px-3 py-2">
              Failed to load upcoming events: {upcomingError.message}
            </p>
          ) : (
            <>
              <div className="border border-[#1a1a1a]">
                {allUpcoming.map(e => <EventRow key={e.id} event={e} muted={false} />)}
              </div>
              {hasMoreUpcoming && (
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => setUpcomingPage(p => p + 1)}
                    disabled={upcomingFetching}
                    className="px-6 py-2 border border-[#1e1e1e] font-display text-[10px] tracking-[0.18em] text-[#555] hover:border-[#d97706] hover:text-[#d97706] transition-colors disabled:opacity-40"
                  >
                    {upcomingFetching ? 'LOADING...' : 'LOAD MORE'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Past */}
      {(allPast.length > 0 || pastError) && (
        <div>
          <div className="text-[10px] font-display tracking-[0.15em] text-[#444] mb-3">
            PAST — {allPast.length}{hasMorePast ? '+' : ''}
          </div>
          {pastError ? (
            <p className="font-mono text-red-400 text-sm border border-red-900/50 bg-red-950/20 px-3 py-2">
              Failed to load past events: {pastError.message}
            </p>
          ) : (
            <>
              <div className="border border-[#1a1a1a]">
                {allPast.map(e => <EventRow key={e.id} event={e} muted={true} />)}
              </div>
              {hasMorePast && (
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => setPastPage(p => p + 1)}
                    disabled={pastFetching}
                    className="px-6 py-2 border border-[#1e1e1e] font-display text-[10px] tracking-[0.18em] text-[#555] hover:border-[#d97706] hover:text-[#d97706] transition-colors disabled:opacity-40"
                  >
                    {pastFetching ? 'LOADING...' : 'LOAD MORE'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {allUpcoming.length === 0 && allPast.length === 0 && !upcomingLoading && !pastLoading && (
        <p className="font-mono text-xs text-[#333]">No events scheduled yet.</p>
      )}
    </div>
  )
}
