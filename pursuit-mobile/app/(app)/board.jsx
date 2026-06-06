import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export default function Board() {
  const [uid, setUid] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUid(session.user.id)
    })
  }, [])

  const { data: wrestlers = [], isLoading, error } = useQuery({
    queryKey: ['board'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wrestlers').select('id, name, current_weight, weight_class').eq('show_on_board', true).order('weight_class', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!uid,
    staleTime: 30_000,
  })

  if (isLoading) {
    return <View style={s.center}><Text style={s.loading}>LOADING...</Text></View>
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>TEAM BOARD</Text>
      <Text style={s.subtitle}>Wrestlers who opted in via Profile → Show on Team Board</Text>

      {wrestlers.length === 0 ? (
        <Text style={s.emptyText}>
          No wrestlers have opted in yet. Enable "Show on Team Board" in your Profile to appear here.
        </Text>
      ) : (
        <View style={s.table}>
          {/* Header */}
          <View style={[s.row, s.headerRow]}>
            {['WRESTLER', 'CLASS', 'WEIGHT', 'TO CUT'].map(h => (
              <Text key={h} style={[s.cell, s.headerCell]}>{h}</Text>
            ))}
          </View>
          {wrestlers.map(w => {
            const rawCut = w.current_weight != null && w.weight_class != null
              ? w.current_weight - w.weight_class : null
            const onWeight = rawCut !== null && rawCut <= 0
            const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null
            const highlight = lbsToCut !== null && !onWeight && lbsToCut > 5
            return (
              <View key={w.id} style={[s.row, s.dataRow]}>
                <Text style={[s.cell, s.nameCell]}>
                  {w.name && !w.name.includes('@') ? w.name : '—'}
                </Text>
                <Text style={[s.cell, s.dataCell]}>
                  {w.weight_class != null ? `${w.weight_class}` : '—'}
                </Text>
                <Text style={[s.cell, s.dataCell]}>
                  {w.current_weight != null ? `${w.current_weight}` : '—'}
                </Text>
                <Text style={[s.cell, s.dataCell, highlight && { color: '#d97706' }]}>
                  {lbsToCut !== null
                    ? (onWeight ? 'ON WEIGHT' : `${lbsToCut.toFixed(1)}`)
                    : '—'}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' },
  loading: { fontSize: 11, color: '#888', letterSpacing: 6, fontFamily: 'monospace' },
  pageTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: '#f0f0f0', fontFamily: 'monospace' },
  subtitle: { fontSize: 10, color: '#888', fontFamily: 'monospace', letterSpacing: 2, marginTop: 2 },
  emptyText: { fontSize: 11, color: '#333', fontFamily: 'monospace', lineHeight: 18 },
  table: { borderWidth: 1, borderColor: '#1a1a1a' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111' },
  headerRow: { backgroundColor: '#080808' },
  dataRow: {},
  cell: { flex: 1, paddingHorizontal: 10, paddingVertical: 10 },
  headerCell: { fontSize: 10, letterSpacing: 3, color: '#888', fontFamily: 'monospace' },
  nameCell: { fontSize: 13, color: '#ccc', fontFamily: 'monospace' },
  dataCell: { fontSize: 13, color: '#aaa', fontFamily: 'monospace' },
})
