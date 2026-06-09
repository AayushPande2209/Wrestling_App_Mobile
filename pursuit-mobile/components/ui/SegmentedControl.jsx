import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, radii, MIN_TOUCH, spacing } from '../../constants/theme'
import AppText from './AppText'

export default function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.track}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <AppText
              variant="footnote"
              color={active ? colors.text : colors.textSecondary}
              style={active ? styles.activeLabel : undefined}
            >
              {opt.label}
            </AppText>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm - 2,
    paddingHorizontal: spacing.sm,
  },
  segmentActive: {
    backgroundColor: colors.surface,
  },
  activeLabel: { fontWeight: '600' },
})
