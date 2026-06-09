import { useRef, useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'

export const WEIGHT_CLASSES = [106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 190, 215, 285]
const ITEM_H = 48
const VISIBLE = 5
const PAD_ITEMS = 2

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
    const clamped = Math.max(0, Math.min(idx, WEIGHT_CLASSES.length - 1))
    setLiveIndex(clamped)
  }, [])

  const handleScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
    const clamped = Math.max(0, Math.min(idx, WEIGHT_CLASSES.length - 1))
    setSelectedIndex(clamped)
    setLiveIndex(clamped)
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: false })
    onChange(WEIGHT_CLASSES[clamped])
  }, [onChange])

  return (
    <View style={wc.root}>
      <Text style={wc.display}>
        {WEIGHT_CLASSES[liveIndex]}
        <Text style={wc.displayUnit}> lbs</Text>
      </Text>

      <View style={wc.colWrap}>
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          nestedScrollEnabled
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          contentContainerStyle={wc.colContent}
        >
          {WEIGHT_CLASSES.map((cls, i) => {
            const dist = Math.abs(i - liveIndex)
            const isCenter = dist === 0
            return (
              <View key={cls} style={wc.item}>
                <Text style={[
                  wc.itemText,
                  isCenter && wc.itemSelected,
                  { opacity: isCenter ? 1 : Math.max(0.15, 0.6 - dist * 0.2) },
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
  display:      { fontSize: 34, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] },
  displayUnit:  { fontSize: 17, color: colors.textSecondary, fontWeight: '400' },
  colWrap:      { width: 120, height: ITEM_H * VISIBLE, overflow: 'hidden' },
  colContent:   { paddingVertical: ITEM_H * PAD_ITEMS },
  item:         { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText:     { fontSize: 22, color: colors.textTertiary },
  itemSelected: { fontSize: 32, fontWeight: '700', color: colors.text },
  lineTop:      { position: 'absolute', top: ITEM_H * PAD_ITEMS, left: 8, right: 8, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  lineBot:      { position: 'absolute', top: ITEM_H * PAD_ITEMS + ITEM_H, left: 8, right: 8, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
})
