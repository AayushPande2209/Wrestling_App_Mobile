import { Text } from 'react-native'
import { typography, colors } from '../../constants/theme'

export default function AppText({ variant = 'body', color, style, children, ...props }) {
  return (
    <Text
      style={[
        typography[variant] ?? typography.body,
        color ? { color } : null,
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  )
}

export function StatText({ children, style, color = colors.text, ...props }) {
  return (
    <Text
      style={[typography.stat, { color }, style]}
      {...props}
    >
      {children}
    </Text>
  )
}
