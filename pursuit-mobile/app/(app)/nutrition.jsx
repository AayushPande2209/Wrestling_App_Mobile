import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL

const MEAL_TYPE_LABELS = { breakfast: 'BREAKFAST', lunch: 'LUNCH', dinner: 'DINNER', other: 'MEAL' }

function MacroRow({ label, value, unit = 'g', color = '#888' }) {
  return (
    <View style={s.macroRow}>
      <Text style={s.macroLabel}>{label}</Text>
      <Text style={[s.macroValue, { color }]}>{value}<Text style={s.macroUnit}> {unit}</Text></Text>
    </View>
  )
}

function MealCard({ meal }) {
  return (
    <View style={s.mealCard}>
      <Text style={s.mealType}>{MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type.toUpperCase()}</Text>
      <Text style={s.mealName}>{meal.name}</Text>
      <MacroRow label="CALORIES" value={meal.calories} unit="kcal" color="#f0f0f0" />
      <MacroRow label="PROTEIN" value={`${meal.protein}`} color="#d97706" />
      <MacroRow label="CARBS" value={`${meal.carbs}`} color="#888" />
      <MacroRow label="FAT" value={`${meal.fat}`} color="#555" />
      {meal.sodium != null && <MacroRow label="SODIUM" value={meal.sodium} unit="mg" color="#3b82f6" />}
    </View>
  )
}

async function fetchWithAuth(url, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No session')
  const { _ts, ...payload } = body
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export default function Nutrition() {
  const [mpWeight, setMpWeight] = useState('')
  const [mpClass, setMpClass] = useState('')
  const [mpDays, setMpDays] = useState('')
  const [mpInputs, setMpInputs] = useState(null)

  const [rcBefore, setRcBefore] = useState('')
  const [rcAfter, setRcAfter] = useState('')
  const [rcHours, setRcHours] = useState('')
  const [rcInputs, setRcInputs] = useState(null)

  const { data: mealPlan, isFetching: mpFetching, isError: mpError } = useQuery({
    queryKey: ['meal-plan', mpInputs],
    queryFn: () => fetchWithAuth(`${API_URL}/predict/meal-plan`, mpInputs),
    enabled: !!mpInputs,
    staleTime: 300_000,
    retry: false,
  })

  const { data: recovery, isFetching: rcFetching, isError: rcError } = useQuery({
    queryKey: ['recovery', rcInputs],
    queryFn: () => fetchWithAuth(`${API_URL}/predict/recovery-protocol`, rcInputs),
    enabled: !!rcInputs,
    staleTime: 300_000,
    retry: false,
  })

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>NUTRITION</Text>

      {/* ── Cut Meal Planner ── */}
      <Text style={s.sectionLabel}>CUT MEAL PLANNER</Text>
      <View style={s.card}>
        <Text style={s.fieldLabel}>CURRENT WEIGHT (LBS)</Text>
        <TextInput value={mpWeight} onChangeText={setMpWeight} style={s.input} keyboardType="decimal-pad" placeholder="158.5" placeholderTextColor="#2a2a2a" />
        <Text style={s.fieldLabel}>TARGET CLASS (LBS)</Text>
        <TextInput value={mpClass} onChangeText={setMpClass} style={s.input} keyboardType="numeric" placeholder="152" placeholderTextColor="#2a2a2a" />
        <Text style={s.fieldLabel}>DAYS UNTIL WEIGH-IN</Text>
        <TextInput value={mpDays} onChangeText={setMpDays} style={s.input} keyboardType="numeric" placeholder="7" placeholderTextColor="#2a2a2a" />
        <TouchableOpacity
          onPress={() => setMpInputs({ current_weight: parseFloat(mpWeight), target_weight_class: parseInt(mpClass), days_until_weigh_in: parseInt(mpDays), _ts: Date.now() })}
          disabled={mpFetching}
          style={[s.btn, mpFetching && s.btnDisabled]}
        >
          <Text style={s.btnText}>{mpFetching ? 'LOADING...' : 'GET MEAL PLAN'}</Text>
        </TouchableOpacity>
      </View>

      {mpInputs && !mpFetching && mpError && (
        <Text style={s.mutedText}>Meal suggestions unavailable right now.</Text>
      )}

      {mealPlan && (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>DAILY TARGETS</Text>
            <View style={s.macrosGrid}>
              {[
                { label: 'CALORIES', value: mealPlan.daily_calories, unit: 'kcal', color: '#f0f0f0' },
                { label: 'PROTEIN', value: mealPlan.daily_macros.protein, unit: 'g', color: '#d97706' },
                { label: 'CARBS', value: mealPlan.daily_macros.carbs, unit: 'g', color: '#888' },
                { label: 'FAT', value: mealPlan.daily_macros.fat, unit: 'g', color: '#555' },
                { label: 'SODIUM', value: mealPlan.daily_macros.sodium, unit: 'mg', color: mealPlan.sodium_warning ? '#f59e0b' : '#3b82f6' },
              ].map(({ label, value, unit, color }) => (
                <View key={label} style={s.macroStatBox}>
                  <Text style={s.microLabel}>{label}</Text>
                  <Text style={[s.bigNum, { color }]}>{value}<Text style={s.unit}> {unit}</Text></Text>
                </View>
              ))}
            </View>
          </View>
          {mealPlan.sodium_warning && (
            <View style={s.warningBox}>
              <Text style={s.warningText}>⚠ High sodium — consider lower-sodium alternatives. Target under {mealPlan.sodium_target}mg/day.</Text>
            </View>
          )}
          {mealPlan.meals.map((meal, i) => <MealCard key={i} meal={meal} />)}
        </>
      )}

      {/* ── Recovery Protocol ── */}
      <Text style={[s.sectionLabel, { marginTop: 16 }]}>POST WEIGH-IN RECOVERY</Text>
      <View style={s.card}>
        <Text style={s.fieldLabel}>WEIGHT BEFORE CUT (LBS)</Text>
        <TextInput value={rcBefore} onChangeText={setRcBefore} style={s.input} keyboardType="decimal-pad" placeholder="158.5" placeholderTextColor="#2a2a2a" />
        <Text style={s.fieldLabel}>WEIGHT AFTER WEIGH-IN (LBS)</Text>
        <TextInput value={rcAfter} onChangeText={setRcAfter} style={s.input} keyboardType="decimal-pad" placeholder="152.0" placeholderTextColor="#2a2a2a" />
        <Text style={s.fieldLabel}>HOURS UNTIL FIRST MATCH</Text>
        <TextInput value={rcHours} onChangeText={setRcHours} style={s.input} keyboardType="numeric" placeholder="4" placeholderTextColor="#2a2a2a" />
        <TouchableOpacity
          onPress={() => setRcInputs({ weight_before_cut: parseFloat(rcBefore), weight_after_cut: parseFloat(rcAfter), hours_until_match: parseInt(rcHours), _ts: Date.now() })}
          disabled={rcFetching}
          style={[s.btn, rcFetching && s.btnDisabled]}
        >
          <Text style={s.btnText}>{rcFetching ? 'LOADING...' : 'GET RECOVERY PLAN'}</Text>
        </TouchableOpacity>
      </View>

      {rcInputs && !rcFetching && rcError && (
        <Text style={s.mutedText}>Recovery plan unavailable right now.</Text>
      )}

      {recovery && (
        <>
          <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
            <View>
              <Text style={s.microLabel}>FLUIDS TARGET</Text>
              <Text style={s.fluidValue}>{recovery.fluids_oz}<Text style={s.unit}> oz</Text></Text>
            </View>
            <Text style={s.fluidNote}>Rehydrate before eating. Spread intake — do not drink all at once.</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>TIMELINE</Text>
            {recovery.timeline.map((step, i) => {
              const h = step.hours_before_match
              const timeLabel = h === 0.5 ? '30 min' : `${h}h`
              return (
                <View key={i} style={s.timelineRow}>
                  <Text style={s.timelineTime}>T − {timeLabel}</Text>
                  <Text style={s.timelineAction}>{step.action}</Text>
                </View>
              )
            })}
          </View>
          {recovery.meals.map((meal, i) => <MealCard key={i} meal={meal} />)}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: '#f0f0f0', fontFamily: 'monospace' },
  sectionLabel: { fontSize: 10, letterSpacing: 5, color: '#aaa', fontFamily: 'monospace', borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 8 },
  card: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 16, gap: 8 },
  cardTitle: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginBottom: 8 },
  fieldLabel: { fontSize: 10, letterSpacing: 4, color: '#aaa', fontFamily: 'monospace', marginTop: 6 },
  input: { backgroundColor: '#060606', borderWidth: 1, borderColor: '#1e1e1e', color: '#f0f0f0', fontFamily: 'monospace', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  btn: { backgroundColor: '#d97706', paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 10, letterSpacing: 6, color: '#0a0a0a', fontWeight: 'bold', fontFamily: 'monospace' },
  mutedText: { fontSize: 11, color: '#888', fontFamily: 'monospace' },
  macrosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  macroStatBox: { minWidth: '40%' },
  microLabel: { fontSize: 9, letterSpacing: 3, color: '#888', fontFamily: 'monospace', marginBottom: 2 },
  bigNum: { fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace' },
  unit: { fontSize: 10, color: '#888', fontFamily: 'monospace' },
  warningBox: { borderWidth: 1, borderColor: 'rgba(217,119,6,0.5)', backgroundColor: 'rgba(120,53,15,0.2)', padding: 12 },
  warningText: { fontSize: 11, color: '#fbbf24', fontFamily: 'monospace', lineHeight: 16 },
  mealCard: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', padding: 14, gap: 6 },
  mealType: { fontSize: 9, letterSpacing: 4, color: '#d97706', fontFamily: 'monospace' },
  mealName: { fontSize: 13, color: '#f0f0f0', fontFamily: 'monospace', textTransform: 'capitalize', marginBottom: 4 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  macroLabel: { fontSize: 10, letterSpacing: 2, color: '#aaa', fontFamily: 'monospace' },
  macroValue: { fontSize: 13, fontFamily: 'monospace' },
  macroUnit: { fontSize: 10, color: '#888', fontFamily: 'monospace' },
  fluidValue: { fontSize: 28, fontWeight: 'bold', color: '#d97706', fontFamily: 'monospace' },
  fluidNote: { flex: 1, fontSize: 11, color: '#888', fontFamily: 'monospace', lineHeight: 16 },
  timelineRow: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#111' },
  timelineTime: { fontSize: 10, color: '#d97706', fontFamily: 'monospace', width: 60 },
  timelineAction: { flex: 1, fontSize: 12, color: '#ccc', fontFamily: 'monospace', lineHeight: 17 },
})
