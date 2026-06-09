import { View, ScrollView, StyleSheet } from 'react-native'
import { colors, radii, spacing } from '../../constants/theme'
import AppText from './AppText'
import { StatText } from './AppText'

export default function StatPill({ items }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item, i) => (
        <View key={i} style={[styles.pill, item.highlight && styles.pillHighlight]}>
          <AppText variant="caption" color={colors.textSecondary}>{item.label}</AppText>
          <StatText style={{ fontSize: 20, lineHeight: 24, color: item.color ?? colors.text }}>
            {item.value}
          </StatText>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2 },
  pill: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    minWidth: 88,
    gap: 4,
  },
  pillHighlight: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
})
