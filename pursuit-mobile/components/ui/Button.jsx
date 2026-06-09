import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { colors, radii, MIN_TOUCH } from '../../constants/theme'
import AppText from './AppText'

const variants = {
  primary: {
    container: { backgroundColor: colors.accent },
    text: { color: '#FFFFFF' },
  },
  secondary: {
    container: { backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    text: { color: colors.text },
  },
  ghost: {
    container: { backgroundColor: colors.accentMuted },
    text: { color: colors.accent },
  },
  destructive: {
    container: { backgroundColor: colors.errorMuted },
    text: { color: colors.error },
  },
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  fullWidth = true,
}) {
  const v = variants[variant] ?? variants.primary

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        v.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color} size="small" />
      ) : (
        <AppText variant="headline" style={[{ fontSize: 17 }, v.text]}>{label}</AppText>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
})
