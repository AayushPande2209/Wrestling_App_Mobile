import { useRef, useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'

export const WEIGHT_CLASSES = [106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 190, 215, 285]
const ITEM_H = 48
const VISIBLE = 5

// value: integer weight class (or null → defaults to 150)
// onChange: called with integer weight class on scroll commit
export default function WeightClassPicker({ value, onChange }) {
  const ref = useRef(null)

  const initIdx = (() => {
    const idx = WEIGHT_CLASSES.indexOf(Number(value))
    return idx >= 0 ? idx : WEIGHT_CLASSES.indexOf(150)
  })()

  const [selectedIndex, setSelectedIndex] = useState(initIdx)
  const [liveIndex, setLiveIndex] = useState(initIdx)

  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: initIdx * ITEM_H, animated: false })
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
    setLiveIndex(Math.max(0, Math.min(idx, WEIGHT_CLASSES.length - 1)))
  }, [])

  const handleScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
    const clamped = Math.max(0, Math.min(idx, WEIGHT_CLASSES.length - 1))
    setSelectedIndex(clamped)
    setLiveIndex(clamped)
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true })
    onChange(WEIGHT_CLASSES[clamped])
  }, [onChange])

  return (
    <View style={wc.root}>
      <Text style={wc.display}>
        {WEIGHT_CLASSES[liveIndex]}
        <Text style={wc.displayUnit}> LBS</Text>
      </Text>

      <View style={wc.colWrap}>
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={50}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          contentContainerStyle={wc.colContent}
        >
          {WEIGHT_CLASSES.map((cls, i) => {
            const dist = Math.abs(i - selectedIndex)
            return (
              <View key={cls} style={wc.item}>
                <Text style={[
                  wc.itemText,
                  dist === 0 && wc.itemSelected,
                  { opacity: dist === 0 ? 1 : Math.max(0.12, 0.55 - dist * 0.2) },
                ]}>
                  {cls}
                </Text>
              </View>
            )
          })}
        </ScrollView>
        <View pointerEvents="none" style={wc.lineTop} />
        <View pointerEvents="none" style={wc.lineBot} />
      </View>
    </View>
  )
}

const wc = StyleSheet.create({
  root:         { gap: 12, alignItems: 'center' },
  display:      { fontSize: 36, fontWeight: 'bold', color: '#e8712a', fontFamily: 'monospace', letterSpacing: 2 },
  displayUnit:  { fontSize: 16, color: '#888888', fontFamily: 'monospace', fontWeight: 'normal', letterSpacing: 0 },
  colWrap:      { width: 120, height: ITEM_H * VISIBLE, overflow: 'hidden' },
  colContent:   { paddingVertical: ITEM_H * 2 },
  item:         { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText:     { fontSize: 22, color: '#555555', fontFamily: 'monospace' },
  itemSelected: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },
  lineTop:      { position: 'absolute', top: ITEM_H * 2,          left: 8, right: 8, height: 1, backgroundColor: '#3a3a3a' },
  lineBot:      { position: 'absolute', top: ITEM_H * 2 + ITEM_H, left: 8, right: 8, height: 1, backgroundColor: '#3a3a3a' },
})
