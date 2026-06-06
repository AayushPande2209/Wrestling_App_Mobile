import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#222',
  orange: '#e8712a',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
}

const CARDS = [
  { key: 'workouts',  label: 'WORKOUTS',  icon: 'barbell-outline',   href: '/(app)/logs?tab=WORKOUTS' },
  { key: 'matches',   label: 'MATCHES',   icon: 'shield-outline',    href: '/(app)/logs?tab=MATCHES' },
  { key: 'goals',     label: 'GOALS',     icon: 'trophy-outline',    href: '/(app)/logs?tab=GOALS' },
  { key: 'nutrition', label: 'NUTRITION', icon: 'nutrition-outline', href: '/(app)/nutrition' },
]

export default function Activity() {
  const router = useRouter()
  const [recentItems, setRecentItems] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const uid = session.user.id
        const [{ data: workouts }, { data: matches }, { data: goals }] = await Promise.all([
          supabase.from('workouts').select('workout_type, created_at').eq('wrestler_id', uid).order('created_at', { ascending: false }).limit(3),
          supabase.from('matches').select('opponent_name, result, created_at').eq('wrestler_id', uid).order('created_at', { ascending: false }).limit(3),
          supabase.from('goals').select('description, created_at').eq('wrestler_id', uid).order('created_at', { ascending: false }).limit(3),
        ])
        const items = []
        for (const w of workouts ?? []) items.push({ label: w.workout_type?.toUpperCase() || 'WORKOUT', ts: w.created_at })
        for (const m of matches ?? []) items.push({ label: `${m.result?.toUpperCase()} VS ${m.opponent_name}`, ts: m.created_at })
        for (const g of goals ?? []) items.push({ label: g.description, ts: g.created_at })
        items.sort((a, b) => b.ts.localeCompare(a.ts))
        setRecentItems(items.slice(0, 5))
      } catch { /* silent */ }
    }
    load()
  }, [])

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.orange} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ACTIVITY</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={s.cards}>
        {CARDS.map(card => (
          <TouchableOpacity
            key={card.key}
            onPress={() => router.push(card.href)}
            activeOpacity={0.7}
            style={s.card}
          >
            <Ionicons name={card.icon} size={22} color={C.orange} />
            <Text style={s.cardLabel}>{card.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.recentCard}>
        <Text style={s.recentTitle}>RECENT ACTIVITY</Text>
        {recentItems.length === 0 ? (
          <Text style={s.emptyText}>No recent activity.</Text>
        ) : (
          recentItems.map((item, i) => (
            <View key={i} style={[s.recentRow, i < recentItems.length - 1 && s.recentRowBorder]}>
              <Text style={s.recentLabel} numberOfLines={1}>{item.label}</Text>
              <Text style={s.recentDate}>
                {new Date(item.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.bg },
  content:         { padding: 16, paddingBottom: 24, gap: 12 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerTitle:     { fontSize: 13, fontWeight: 'bold', letterSpacing: 6, color: C.text, fontFamily: 'monospace' },
  cards:           { flexDirection: 'row', gap: 8 },
  card:            { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: '#252525', borderRadius: 8, padding: 10, alignItems: 'center', gap: 6 },
  cardLabel:       { fontSize: 9, letterSpacing: 2, color: C.textMuted, fontFamily: 'monospace', textAlign: 'center' },
  recentCard:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 14 },
  recentTitle:     { fontSize: 9, letterSpacing: 4, color: C.orange, fontFamily: 'monospace', marginBottom: 10 },
  recentRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  recentLabel:     { fontSize: 10, color: C.text, fontFamily: 'monospace', flex: 1, marginRight: 8 },
  recentDate:      { fontSize: 10, color: C.textMuted, fontFamily: 'monospace' },
  emptyText:       { fontSize: 10, color: C.textDim, fontFamily: 'monospace' },
})
