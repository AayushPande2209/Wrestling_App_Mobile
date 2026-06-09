import { TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radii, MIN_TOUCH, spacing } from '../../constants/theme'
import AppText from './AppText'

export default function QuickActionChip({ icon, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.chip}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <AppText variant="footnote" color={colors.text} style={styles.label}>{label}</AppText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    minHeight: MIN_TOUCH + 12,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  label: { fontWeight: '600', fontSize: 14 },
})
