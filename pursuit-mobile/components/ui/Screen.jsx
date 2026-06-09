import { ScrollView, View, StyleSheet, ActivityIndicator } from 'react-native'
import { colors, spacing } from '../../constants/theme'
import AppText from './AppText'

export default function Screen({
  children,
  scroll = false,
  contentStyle,
  style,
  loading = false,
  error = null,
  padding = true,
}) {
  if (loading) {
    return (
      <View style={[styles.center, style]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.center, style]}>
        <AppText variant="body" color={colors.error}>{error}</AppText>
      </View>
    )
  }

  const pad = padding ? { paddingHorizontal: spacing.md, paddingBottom: spacing.lg } : null

  if (scroll) {
    return (
      <ScrollView
        style={[styles.root, style]}
        contentContainerStyle={[pad, { gap: spacing.md }, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    )
  }

  return (
    <View style={[styles.root, pad, { gap: spacing.md }, style, contentStyle]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.md },
})
