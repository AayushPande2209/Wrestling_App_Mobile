import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radii, hitSlop, MIN_TOUCH } from '../../constants/theme'
import AppText from './AppText'

export default function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  avatarLabel,
  onAvatarPress,
  large = false,
}) {
  const router = useRouter()

  function handleBack() {
    if (onBack) onBack()
    else router.back()
  }

  if (large) {
    return (
      <View style={styles.largeWrap}>
        <View style={styles.largeTop}>
          <View style={styles.largeText}>
            {subtitle ? <AppText variant="subhead">{subtitle}</AppText> : null}
            {title ? <AppText variant="largeTitle">{title}</AppText> : null}
          </View>
          {onAvatarPress ? (
            <TouchableOpacity
              onPress={onAvatarPress}
              activeOpacity={0.7}
              hitSlop={hitSlop}
              style={styles.avatar}
            >
              <AppText variant="headline" color={colors.accent}>
                {(avatarLabel ?? '?').charAt(0).toUpperCase()}
              </AppText>
            </TouchableOpacity>
          ) : rightAction}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.inline}>
      {showBack ? (
        <TouchableOpacity onPress={handleBack} hitSlop={hitSlop} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <View style={styles.inlineCenter}>
        {title ? <AppText variant="headline" numberOfLines={1}>{title}</AppText> : null}
        {subtitle ? <AppText variant="footnote" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      <View style={styles.rightSlot}>{rightAction ?? <View style={styles.backPlaceholder} />}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  largeWrap: { paddingBottom: spacing.sm },
  largeTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  largeText: { flex: 1, gap: 2 },
  avatar: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    marginBottom: spacing.sm,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backPlaceholder: { width: 40 },
  inlineCenter: { flex: 1, alignItems: 'center' },
  rightSlot: { width: 40, alignItems: 'flex-end' },
})
