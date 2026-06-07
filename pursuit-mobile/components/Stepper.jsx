import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

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
  stepper:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn:     { width: 28, height: 28, backgroundColor: '#1e1208', borderRadius: 4, borderWidth: 0.5, borderColor: '#2a1a08', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#e8712a', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  stepValue:   { color: '#ccc', fontSize: 11, fontFamily: 'monospace', minWidth: 36, textAlign: 'center' },
})
