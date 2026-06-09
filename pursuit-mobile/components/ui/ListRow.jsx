import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, MIN_TOUCH, spacing } from '../../constants/theme'
import AppText from './AppText'

export default function ListRow({ label, value, icon, onPress, destructive = false, showChevron = true }) {
  const content = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? colors.error : colors.accent}
          style={styles.icon}
        />
      ) : null}
      <AppText
        variant="body"
        color={destructive ? colors.error : colors.text}
        style={styles.label}
      >
        {label}
      </AppText>
      {value ? <AppText variant="body" color={colors.textSecondary}>{value}</AppText> : null}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      ) : null}
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.row}>
        {content}
      </TouchableOpacity>
    )
  }

  return <View style={styles.row}>{content}</View>
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  icon: { marginRight: spacing.sm },
  label: { flex: 1 },
})
