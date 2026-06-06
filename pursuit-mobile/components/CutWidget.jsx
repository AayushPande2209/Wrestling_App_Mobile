import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function CutWidget({ onNavigate }) {
  const [wrestler, setWrestler] = useState(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('wrestlers')
        .select('current_weight, weight_class')
        .eq('id', session.user.id)
        .single()
      if (data) setWrestler(data)
    }
    load()
  }, [pathname])

  const rawCut =
    wrestler?.current_weight != null && wrestler?.weight_class != null
      ? wrestler.current_weight - wrestler.weight_class
      : null
  const onWeight = rawCut !== null && rawCut <= 0
  const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null

  function handleLogWeight() {
    onNavigate?.()
    router.push('/(app)/weight')
  }

  return (
    <View style={s.container}>
      <Text style={s.label}>TO CUT</Text>
      {lbsToCut !== null ? (
        <>
          <Text style={[s.value, onWeight ? s.valueGreen : s.valueOrange]}>
            {onWeight ? '0.0' : lbsToCut.toFixed(1)}
            <Text style={s.unit}> LBS</Text>
          </Text>
          {onWeight && <Text style={s.onWeightLabel}>ON WEIGHT</Text>}
          <Text style={s.route}>
            {wrestler.current_weight} → {wrestler.weight_class}
          </Text>
        </>
      ) : (
        <Text style={s.dash}>—</Text>
      )}
      <TouchableOpacity onPress={handleLogWeight} style={s.logBtn}>
        <Text style={s.logBtnText}>+ LOG WEIGHT</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a1a08',
  },
  label: { fontSize: 9, letterSpacing: 4, color: '#888', fontFamily: 'monospace', marginBottom: 4 },
  value: { fontSize: 28, fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 32 },
  valueOrange: { color: '#e8712a' },
  valueGreen: { color: '#22c55e' },
  unit: { fontSize: 11, fontWeight: 'normal', color: '#666' },
  onWeightLabel: { fontSize: 9, color: '#22c55e', letterSpacing: 4, fontFamily: 'monospace', marginTop: 2 },
  route: { fontSize: 10, color: '#444', fontFamily: 'monospace', marginTop: 6 },
  dash: { fontSize: 24, fontWeight: 'bold', color: '#333', fontFamily: 'monospace' },
  logBtn: {
    marginTop: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2a1a08',
    alignItems: 'center',
  },
  logBtnText: { fontSize: 9, letterSpacing: 4, color: '#e8712a', fontFamily: 'monospace', fontWeight: '500' },
})
