import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, radii, spacing, shadows } from '../../constants/theme'

export default function Card({ children, onPress, style, elevated = false }) {
  const content = (
    <View style={[styles.card, elevated && shadows.card, style]}>
      {children}
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
})
