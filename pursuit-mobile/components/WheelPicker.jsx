import { useRef, useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'

const ITEM_H = 44
const VISIBLE = 5
const DIGITS   = ['0','1','2','3','4','5','6','7','8','9']
const HUNDREDS = ['0','1','2']

const makeWeight = (h, t, o, d) => `${h}${t}${o}.${d}`

function Column({ items, initialIndex = 0, onIndexChange, onLiveChange }) {
  const ref = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)

  // Scroll to initial position after layout
  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: initialIndex * ITEM_H, animated: false })
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Update live display during scroll (throttled)
  const handleScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
    onLiveChange(Math.max(0, Math.min(idx, items.length - 1)))
  }, [items.length, onLiveChange])

  // Snap and commit on drag/momentum end
  const handleScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
    const clamped = Math.max(0, Math.min(idx, items.length - 1))
    setSelectedIndex(clamped)
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true })
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
        onScroll={handleScroll}
        scrollEventThrottle={50}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={wp.colContent}
      >
        {items.map((item, i) => {
          const dist = Math.abs(i - selectedIndex)
          return (
            <View key={i} style={wp.item}>
              <Text style={[
                wp.itemText,
                dist === 0 && wp.itemSelected,
                { opacity: dist === 0 ? 1 : Math.max(0.12, 0.55 - dist * 0.2) },
              ]}>
                {item}
              </Text>
            </View>
          )
        })}
      </ScrollView>
      {/* Selection bracket lines */}
      <View pointerEvents="none" style={wp.lineTop} />
      <View pointerEvents="none" style={wp.lineBot} />
    </View>
  )
}

// value: string like "152.5"
// onChange: called with new weight string on every column commit (scroll end)
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
  // digitsRef always holds the latest committed digits for stale-closure-free onChange calls
  const digitsRef = useRef({ ...init })

  // Live display (updates ~20fps during scroll via onLiveChange)
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
      {/* Live assembled weight display */}
      <Text style={wp.display}>
        {liveH}{liveT}{liveO}.{liveD}
        <Text style={wp.displayUnit}> LBS</Text>
      </Text>

      {/* Four digit columns + decimal separator */}
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

  display:       { fontSize: 36, fontWeight: 'bold', color: '#e8712a', fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2 },
  displayUnit:   { fontSize: 16, color: '#888888', fontFamily: 'monospace', fontWeight: 'normal', letterSpacing: 0 },

  wheel:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  colWrap:       { width: 52, height: ITEM_H * VISIBLE, overflow: 'hidden' },
  colContent:    { paddingVertical: ITEM_H * 2 },
  item:          { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText:      { fontSize: 20, color: '#555555', fontFamily: 'monospace' },
  itemSelected:  { fontSize: 28, fontWeight: 'bold', color: '#ffffff' },

  // Hairlines that bracket the selected (center) item
  lineTop:       { position: 'absolute', top: ITEM_H * 2,       left: 6, right: 6, height: 1, backgroundColor: '#3a3a3a' },
  lineBot:       { position: 'absolute', top: ITEM_H * 2 + ITEM_H, left: 6, right: 6, height: 1, backgroundColor: '#3a3a3a' },

  separator:     { width: 20, height: ITEM_H * VISIBLE, alignItems: 'center', justifyContent: 'center' },
  separatorText: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' },
})
