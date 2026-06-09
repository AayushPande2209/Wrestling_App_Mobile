import { useRef, useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'

const ITEM_H = 44
const VISIBLE = 5
const PAD_ITEMS = 2
const DIGITS   = ['0','1','2','3','4','5','6','7','8','9']
const HUNDREDS = ['0','1','2']

const makeWeight = (h, t, o, d) => `${h}${t}${o}.${d}`

function Column({ items, initialIndex = 0, onIndexChange, onLiveChange }) {
  const ref = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const [liveIndex, setLiveIndex] = useState(initialIndex)

  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: initialIndex * ITEM_H, animated: false })
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
    const clamped = Math.max(0, Math.min(idx, items.length - 1))
    setLiveIndex(clamped)
    onLiveChange(clamped)
  }, [items.length, onLiveChange])

  const handleScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
    const clamped = Math.max(0, Math.min(idx, items.length - 1))
    setSelectedIndex(clamped)
    setLiveIndex(clamped)
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: false })
    onIndexChange(clamped)
    onLiveChange(clamped)
  }, [items.length, onIndexChange, onLiveChange])

  return (
    <View style={wp.colWrap}>
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
        contentContainerStyle={wp.colContent}
      >
        {items.map((item, i) => {
          const dist = Math.abs(i - liveIndex)
          const isCenter = dist === 0
          return (
            <View key={i} style={wp.item}>
              <Text style={[
                wp.itemText,
                isCenter && wp.itemSelected,
                { opacity: isCenter ? 1 : Math.max(0.15, 0.6 - dist * 0.2) },
              ]}>
                {item}
              </Text>
            </View>
          )
        })}
      </ScrollView>
      <View pointerEvents="none" style={wp.lineTop} />
      <View pointerEvents="none" style={wp.lineBot} />
    </View>
  )
}

export default function WheelPicker({ value, onChange }) {
  const parseDigits = (v) => {
    const n = parseFloat(v)
    if (isNaN(n) || n <= 0) return { h: 1, t: 5, o: 0, d: 0 }
    const intPart = Math.floor(n)
    const d = Math.round((n - intPart) * 10) % 10
    const h = Math.min(2, Math.floor(intPart / 100))
    const t = Math.floor((intPart % 100) / 10)
    const o = intPart % 10
    return { h, t, o, d }
  }

  const init = parseDigits(value)
  const digitsRef = useRef({ ...init })

  const [liveH, setLiveH] = useState(init.h)
  const [liveT, setLiveT] = useState(init.t)
  const [liveO, setLiveO] = useState(init.o)
  const [liveD, setLiveD] = useState(init.d)

  const handleH = useCallback((idx) => {
    digitsRef.current.h = idx
    const { h, t, o, d } = digitsRef.current
    onChange(makeWeight(h, t, o, d))
  }, [onChange])

  const handleT = useCallback((idx) => {
    digitsRef.current.t = idx
    const { h, t, o, d } = digitsRef.current
    onChange(makeWeight(h, t, o, d))
  }, [onChange])

  const handleO = useCallback((idx) => {
    digitsRef.current.o = idx
    const { h, t, o, d } = digitsRef.current
    onChange(makeWeight(h, t, o, d))
  }, [onChange])

  const handleD = useCallback((idx) => {
    digitsRef.current.d = idx
    const { h, t, o, d } = digitsRef.current
    onChange(makeWeight(h, t, o, d))
  }, [onChange])

  return (
    <View style={wp.root}>
      <Text style={wp.display}>
        {liveH}{liveT}{liveO}.{liveD}
        <Text style={wp.displayUnit}> lbs</Text>
      </Text>

      <View style={wp.wheel}>
        <Column items={HUNDREDS} initialIndex={init.h} onIndexChange={handleH} onLiveChange={setLiveH} />
        <Column items={DIGITS}   initialIndex={init.t} onIndexChange={handleT} onLiveChange={setLiveT} />
        <Column items={DIGITS}   initialIndex={init.o} onIndexChange={handleO} onLiveChange={setLiveO} />
        <View style={wp.separator}>
          <Text style={wp.separatorText}>.</Text>
        </View>
        <Column items={DIGITS}   initialIndex={init.d} onIndexChange={handleD} onLiveChange={setLiveD} />
      </View>
    </View>
  )
}

const wp = StyleSheet.create({
  root:          { gap: 12 },
  display:       { fontSize: 34, fontWeight: '700', color: colors.accent, textAlign: 'center', fontVariant: ['tabular-nums'] },
  displayUnit:   { fontSize: 17, color: colors.textSecondary, fontWeight: '400' },
  wheel:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colWrap:       { width: 52, height: ITEM_H * VISIBLE, overflow: 'hidden' },
  colContent:    { paddingVertical: ITEM_H * PAD_ITEMS },
  item:          { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText:      { fontSize: 20, color: colors.textTertiary },
  itemSelected:  { fontSize: 28, fontWeight: '700', color: colors.text },
  lineTop:       { position: 'absolute', top: ITEM_H * PAD_ITEMS, left: 6, right: 6, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  lineBot:       { position: 'absolute', top: ITEM_H * PAD_ITEMS + ITEM_H, left: 6, right: 6, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  separator:     { width: 20, height: ITEM_H * VISIBLE, alignItems: 'center', justifyContent: 'center' },
  separatorText: { fontSize: 28, fontWeight: '700', color: colors.text },
})
