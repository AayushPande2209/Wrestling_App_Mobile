import { View, TouchableOpacity, StyleSheet, StatusBar } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, usePathname, Slot } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../constants/theme'
import AppText from '../../components/ui/AppText'

const TABS = [
  { key: 'today',  label: 'Today',  icon: 'today-outline',              iconActive: 'today',              href: '/(app)/' },
  { key: 'weight', label: 'Weight', icon: 'scale-outline',              iconActive: 'scale',              href: '/(app)/weight' },
  { key: 'coach',  label: 'Coach',  icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses', href: '/(app)/coach' },
  { key: 'log',    label: 'Log',    icon: 'add-circle-outline',         iconActive: 'add-circle',         href: '/(app)/log' },
]

function BottomTabBar() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  function isActive(tab) {
    if (tab.key === 'today') {
      return pathname === '/' || pathname === '/(app)/' || pathname === '/(app)'
    }
    const segment = tab.href.replace('/(app)/', '')
    return pathname.includes(`/${segment}`)
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map(tab => {
        const active = isActive(tab)
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => router.push(tab.href)}
            activeOpacity={0.7}
            style={styles.tab}
          >
            <Ionicons
              name={active ? tab.iconActive : tab.icon}
              size={24}
              color={active ? colors.accent : colors.textTertiary}
            />
            <AppText
              variant="caption"
              color={active ? colors.accent : colors.textTertiary}
              style={active ? styles.labelActive : undefined}
            >
              {tab.label}
            </AppText>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const SECONDARY_ROUTES = ['profile', 'board']

function useShowTabBar() {
  const pathname = usePathname()
  return !SECONDARY_ROUTES.some(route => pathname === `/${route}` || pathname.endsWith(`/${route}`))
}

export default function AppLayout() {
  const showTabBar = useShowTabBar()

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Slot />
      </SafeAreaView>
      {showTabBar ? <BottomTabBar /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 2,
    minHeight: 49,
  },
  labelActive: { fontWeight: '600' },
})
