import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppText from './AppText'
import { colors, radii, spacing } from '../../constants/theme'

export default function Toast({ message, onHide, duration = 2400 }) {
  const insets = useSafeAreaInsets()
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(-12)

  useEffect(() => {
    if (!message) return
    opacity.value = withTiming(1, { duration: 200 })
    translateY.value = withTiming(0, { duration: 200 })
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 220 })
      translateY.value = withTiming(-8, { duration: 220 }, (done) => {
        if (done) runOnJS(onHide)()
      })
    }, duration)
    return () => clearTimeout(timer)
  }, [message])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  if (!message) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + spacing.sm }, animStyle]}
    >
      <View style={styles.toast}>
        <AppText variant="subhead" style={styles.text}>{message}</AppText>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 999,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  text: { color: colors.text, textAlign: 'center' },
})
