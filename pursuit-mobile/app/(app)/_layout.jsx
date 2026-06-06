import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, usePathname, Slot } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import CutWidget from '../../components/CutWidget'

const NAV = [
  { href: '/(app)/',         label: 'DASHBOARD',  icon: 'grid' },
  { href: '/(app)/logs',     label: 'LOGS',       icon: 'list' },
  { href: '/(app)/nutrition',label: 'NUTRITION',  icon: 'coffee' },
  { href: '/(app)/records',  label: 'RECORDS',    icon: 'award' },
  { href: '/(app)/board',    label: 'BOARD',      icon: 'users' },
  { href: '/(app)/coach',    label: 'COACH',      icon: 'cpu' },
  { href: '/(app)/profile',  label: 'PROFILE',    icon: 'user' },
]

function Sidebar({ visible, onClose }) {
  const router = useRouter()
  const pathname = usePathname()

  function navTo(href) {
    onClose()
    router.push(href)
  }

  async function handleSignOut() {
    onClose()
    await supabase.auth.signOut()
    router.replace('/(auth)')
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <Pressable style={s.overlayBg} onPress={onClose} />
        <View style={s.sidebar}>
          <SafeAreaView style={s.sidebarInner}>
            {/* Logo row */}
            <View style={s.logoRow}>
              <View>
                <Text style={s.logoText}>PURSUIT</Text>
                <Text style={s.logoSub}>TRAINING SYSTEM</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.closeBtn}>
                <Feather name="x" size={18} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Cut widget */}
            <CutWidget onNavigate={onClose} />

            {/* Nav items */}
            <ScrollView style={s.nav} showsVerticalScrollIndicator={false}>
              {NAV.map(({ href, label, icon }) => {
                const active = pathname === '/' ? href === '/(app)/' : pathname.includes(label.toLowerCase())
                return (
                  <TouchableOpacity
                    key={href}
                    onPress={() => navTo(href)}
                    style={[s.navItem, active && s.navItemActive]}
                  >
                    <Feather
                      name={icon}
                      size={14}
                      color={active ? '#e8712a' : '#444'}
                    />
                    <Text style={[s.navLabel, active && s.navLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            {/* Sign out */}
            <TouchableOpacity onPress={handleSignOut} style={s.signOut}>
              <Text style={s.signOutText}>SIGN OUT</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  )
}

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <View style={s.root}>
      <Sidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header bar */}
      <SafeAreaView style={s.headerSafe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.menuBtn}>
            <Feather name="menu" size={22} color="#e8712a" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>PURSUIT</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      {/* Page content */}
      <View style={s.content}>
        <Slot />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  // Drawer / sidebar
  overlay: { flex: 1, flexDirection: 'row' },
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sidebar: {
    width: 280,
    backgroundColor: '#111',
    borderLeftWidth: 1,
    borderLeftColor: '#1f1f1f',
  },
  sidebarInner: { flex: 1 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  logoText: { fontSize: 20, fontWeight: 'bold', letterSpacing: 10, color: '#e8712a', fontFamily: 'monospace' },
  logoSub: { fontSize: 9, color: '#3a3a3a', letterSpacing: 4, marginTop: 2, fontFamily: 'monospace' },
  closeBtn: { padding: 4 },
  nav: { flex: 1, marginTop: 8 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navItemActive: { backgroundColor: '#1a1208' },
  navLabel: { fontSize: 10, letterSpacing: 6, color: '#666', fontFamily: 'monospace', fontWeight: '500' },
  navLabelActive: { color: '#e8712a' },
  signOut: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    alignItems: 'center',
  },
  signOutText: { fontSize: 10, letterSpacing: 6, color: '#555', fontFamily: 'monospace' },
  // Header
  headerSafe: { backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  menuBtn: { width: 36, alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: 'bold', letterSpacing: 8, color: '#e8712a', fontFamily: 'monospace' },
  // Content
  content: { flex: 1 },
})
