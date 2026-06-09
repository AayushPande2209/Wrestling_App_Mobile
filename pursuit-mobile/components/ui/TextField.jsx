import { TextInput, View, StyleSheet } from 'react-native'
import { colors, radii, MIN_TOUCH, spacing } from '../../constants/theme'
import AppText from './AppText'

export default function TextField({ label, style, inputStyle, ...props }) {
  return (
    <View style={style}>
      {label ? (
        <AppText variant="footnote" style={styles.label}>{label}</AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, inputStyle]}
        {...props}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: MIN_TOUCH,
  },
})
