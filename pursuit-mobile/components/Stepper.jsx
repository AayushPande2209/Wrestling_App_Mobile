import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, radii, MIN_TOUCH } from '../constants/theme'

export default function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix = '' }) {
  return (
    <View style={st.stepper}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - step))}
        activeOpacity={0.7}
        style={st.stepBtn}
      >
        <Text style={st.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={st.stepValue}>{value}{suffix}</Text>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + step))}
        activeOpacity={0.7}
        style={st.stepBtn}
      >
        <Text style={st.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const st = StyleSheet.create({
  stepper:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn:     {
    width: MIN_TOUCH - 8,
    height: MIN_TOUCH - 8,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colors.accent, fontSize: 20, fontWeight: '600', lineHeight: 24 },
  stepValue:   { color: colors.text, fontSize: 15, fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'center' },
})
