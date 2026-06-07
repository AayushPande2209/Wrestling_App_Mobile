import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Pressable, ScrollView, Dimensions, StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, usePathname, Slot } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated'
import { supabase } from '../../lib/supabase'
import CutWidget from '../../components/CutWidget'

const { width: SW, height: SH } = Dimensions.get('window')
const DRAWER_W = Math.round(SW * 0.72)
const SHEET_H = Math.round(SH * 0.72)

const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#222',
  borderAccent: '#2a1a06',
  orange: '#e8712a',
  orangeDim: '#1e1208',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
  red: '#e24a4a',
}

const TABS = [
  { key: 'home',     label: 'HOME',     icon: 'grid-outline',          href: '/(app)/' },
  { key: 'coach',    label: 'COACH',    icon: 'hardware-chip-outline',  href: '/(app)/coach' },
  { key: 'weight',   label: 'WEIGHT',   icon: 'scale-outline',          href: '/(app)/weight' },
  { key: 'activity', label: 'ACTIVITY', icon: 'barbell-outline',        special: 'activity' },
  { key: 'other',    label: 'OTHER',    icon: 'menu-outline',           special: 'other' },
]

const DRAWER_NAV = [
  { key: 'profile',  label: 'PROFILE',   icon: 'person-circle-outline',   href: '/(app)/profile' },
  { key: 'board',    label: 'BOARD',     icon: 'people-outline',           href: '/(app)/board' },
  { divider: true, key: 'd1' },
  { key: 'timeline', label: 'TIMELINE',  icon: 'trending-up-outline',      href: '/(app)/records' },
  { key: 'records',  label: 'RECORDS',   icon: 'trophy-outline',           href: '/(app)/records' },
  { divider: true, key: 'd2' },
  { key: 'signout',  label: 'SIGN OUT',  icon: 'log-out-outline',          color: C.red },
]

const ACTIVITY_CARDS = [
  { key: 'workouts',   label: 'WORKOUTS',   icon: 'barbell-outline',         href: '/(app)/logs?tab=WORKOUTS' },
  { key: 'matches',    label: 'MATCHES',    icon: 'shield-outline',          href: '/(app)/logs?tab=MATCHES' },
  { key: 'goals',      label: 'GOALS',      icon: 'trophy-outline',          href: '/(app)/logs?tab=GOALS' },
  { key: 'notes',      label: 'NOTES',      icon: 'document-text-outline',   href: '/(app)/logs?tab=NOTES' },
  { key: 'nutrition',  label: 'NUTRITION',  icon: 'nutrition-outline',       href: '/(app)/nutrition' },
]

// ─── Other Drawer ─────────────────────────────────────────────────────────────

function OtherDrawer({ visible, onClose }) {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const drawerX = useSharedValue(DRAWER_W)

  useEffect(() => {
    if (visible) {
      drawerX.value = DRAWER_W
      drawerX.value = withTiming(0, { duration: 280 })
    }
  }, [visible])

  function close() {
    drawerX.value = withTiming(DRAWER_W, { duration: 220 }, (done) => {
      if (done) runOnJS(onClose)()
    })
  }

  async function signOut() {
    close()
    await supabase.auth.signOut()
  }

  function navTo(href) {
    close()
    setTimeout(() => router.push(href), 240)
  }

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerX.value }],
  }))

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={ds.overlay}>
        <Pressable style={ds.dim} onPress={close} />
        <Animated.View style={[ds.drawer, animStyle, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={ds.logoRow}>
            <Text style={ds.logoText}>PURSUIT</Text>
            <Text style={ds.logoSub}>TRAINING SYSTEM</Text>
          </View>
          <CutWidget onNavigate={close} />
          <ScrollView style={ds.navScroll} showsVerticalScrollIndicator={false}>
            {DRAWER_NAV.map(item => {
              if (item.divider) return <View key={item.key} style={ds.divider} />
              const isActive =
                item.key === 'profile' ? pathname.includes('/profile') :
                item.key === 'board' ? pathname.includes('/board') :
                item.key === 'records' ? pathname.includes('/records') : false
              if (item.key === 'signout') {
                return (
                  <TouchableOpacity key={item.key} onPress={signOut} activeOpacity={0.7} style={ds.navItem}>
                    <Ionicons name={item.icon} size={18} color={C.red} />
                    <Text style={[ds.navLabel, { color: C.red }]}>{item.label}</Text>
                  </TouchableOpacity>
                )
              }
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => navTo(item.href)}
                  activeOpacity={0.7}
                  style={[ds.navItem, isActive && ds.navItemActive]}
                >
                  <Ionicons name={item.icon} size={18} color={isActive ? C.orange : C.textDim} />
                  <Text style={[ds.navLabel, isActive && ds.navLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const ds = StyleSheet.create({
  overlay:       { flex: 1, flexDirection: 'row' },
  dim:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer:        { width: DRAWER_W, backgroundColor: C.surface, borderLeftWidth: 1, borderLeftColor: C.border },
  logoRow:       { paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  logoText:      { fontSize: 18, fontWeight: 'bold', letterSpacing: 8, color: C.orange, fontFamily: 'monospace' },
  logoSub:       { fontSize: 9, color: C.textMuted, letterSpacing: 4, marginTop: 2, fontFamily: 'monospace' },
  navScroll:     { flex: 1, marginTop: 4 },
  navItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  navItemActive: { backgroundColor: '#1a1208' },
  navLabel:      { fontSize: 11, letterSpacing: 3, color: C.textDim, fontFamily: 'monospace', fontWeight: '500' },
  navLabelActive:{ color: C.orange },
  divider:       { height: 1, backgroundColor: '#1a1a1a', marginVertical: 4 },
})

// ─── Activity Sheet ───────────────────────────────────────────────────────────

function ActivitySheet({ visible, onClose }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const sheetY = useSharedValue(SHEET_H)
  const [recentItems, setRecentItems] = useState([])

  useEffect(() => {
    if (visible) {
      sheetY.value = SHEET_H
      sheetY.value = withTiming(0, { duration: 300 })
      loadRecent()
    }
  }, [visible])

  async function loadRecent() {
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

  function close() {
    sheetY.value = withTiming(SHEET_H, { duration: 250 }, (done) => {
      if (done) runOnJS(onClose)()
    })
  }

  function navTo(href) {
    close()
    setTimeout(() => router.push(href), 260)
  }

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }))

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={as.root}>
        <Pressable style={as.dim} onPress={close} />
        <Animated.View style={[as.sheet, sheetStyle, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={as.header}>
            <TouchableOpacity onPress={close} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={C.orange} />
            </TouchableOpacity>
            <Text style={as.title}>ACTIVITY</Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={as.cards}>
              {ACTIVITY_CARDS.map(card => (
                <TouchableOpacity key={card.key} onPress={() => navTo(card.href)} activeOpacity={0.7} style={as.card}>
                  <Ionicons name={card.icon} size={18} color={C.orange} />
                  <Text style={as.cardLabel}>{card.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={as.recentCard}>
              <Text style={as.recentTitle}>RECENT ACTIVITY</Text>
              {recentItems.length === 0 ? (
                <Text style={as.emptyText}>No recent activity.</Text>
              ) : (
                recentItems.map((item, i) => (
                  <View key={i} style={as.recentRow}>
                    <Text style={as.recentLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={as.recentDate}>
                      {new Date(item.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const as = StyleSheet.create({
  root:         { flex: 1 },
  dim:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:        { height: SHEET_H, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title:        { fontSize: 13, fontWeight: 'bold', letterSpacing: 6, color: C.text, fontFamily: 'monospace' },
  cards:        { flexDirection: 'row', gap: 6, padding: 10 },
  card:         { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: '#252525', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', gap: 6 },
  cardLabel:    { fontSize: 9, letterSpacing: 0, color: C.textMuted, fontFamily: 'monospace', textAlign: 'center' },
  recentCard:   { marginHorizontal: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12 },
  recentTitle:  { fontSize: 9, letterSpacing: 4, color: C.orange, fontFamily: 'monospace', marginBottom: 10 },
  recentRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  recentLabel:  { fontSize: 10, color: C.text, fontFamily: 'monospace', flex: 1, marginRight: 8 },
  recentDate:   { fontSize: 10, color: C.textMuted, fontFamily: 'monospace' },
  emptyText:    { fontSize: 10, color: C.textDim, fontFamily: 'monospace' },
})

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────

function BottomTabBar({ onActivity, onOther }) {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  function isActive(tab) {
    if (tab.special) return false
    if (tab.key === 'home') return pathname === '/' || pathname === '/(app)/' || pathname === '/(app)'
    const segment = tab.href.replace('/(app)/', '')
    return pathname.includes(segment)
  }

  function handlePress(tab) {
    if (tab.special === 'activity') { onActivity(); return }
    if (tab.special === 'other') { onOther(); return }
    router.push(tab.href)
  }

  return (
    <View style={[tb.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map(tab => {
        const active = isActive(tab)
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => handlePress(tab)}
            activeOpacity={0.7}
            style={tb.tab}
          >
            <Ionicons name={tab.icon} size={22} color={active ? C.orange : '#3a3a3a'} />
            <Text style={[tb.label, active && tb.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const tb = StyleSheet.create({
  bar:         { flexDirection: 'row', backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  tab:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 4, gap: 3, minHeight: 44 },
  label:       { fontSize: 9, letterSpacing: 1.5, color: '#3a3a3a', fontFamily: 'monospace' },
  labelActive: { color: C.orange },
})

// ─── Root App Layout ──────────────────────────────────────────────────────────

export default function AppLayout() {
  const [otherOpen, setOtherOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Slot />
      </SafeAreaView>
      <BottomTabBar
        onActivity={() => setActivityOpen(true)}
        onOther={() => setOtherOpen(true)}
      />
      <OtherDrawer visible={otherOpen} onClose={() => setOtherOpen(false)} />
      <ActivitySheet visible={activityOpen} onClose={() => setActivityOpen(false)} />
    </View>
  )
}
