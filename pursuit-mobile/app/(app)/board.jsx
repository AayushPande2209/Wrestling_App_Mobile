import { useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import Screen from '../../components/ui/Screen'
import ScreenHeader from '../../components/ui/ScreenHeader'
import Card from '../../components/ui/Card'
import AppText, { StatText } from '../../components/ui/AppText'
import { colors, spacing } from '../../constants/theme'

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

  return (
    <Screen scroll loading={isLoading} error={error?.message} contentStyle={{ paddingTop: spacing.md }}>
      <ScreenHeader title="Team board" showBack />
      <AppText variant="footnote" color={colors.textTertiary}>
        Wrestlers who opted in via Profile.
      </AppText>

      {wrestlers.length === 0 ? (
        <Card>
          <AppText variant="body" color={colors.textSecondary}>
            No wrestlers have opted in yet. Enable "Show on team board" in your profile to appear here.
          </AppText>
        </Card>
      ) : (
        wrestlers.map(w => {
          const rawCut = w.current_weight != null && w.weight_class != null
            ? w.current_weight - w.weight_class : null
          const onWeight = rawCut !== null && rawCut <= 0
          const lbsToCut = rawCut !== null ? Math.max(0, rawCut) : null
          const isMe = w.id === uid
          const displayName = w.name && !w.name.includes('@') ? w.name : '—'

          return (
            <Card key={w.id} style={isMe ? styles.myRow : undefined}>
              <View style={styles.rowTop}>
                <AppText variant="headline">{displayName}</AppText>
                {isMe ? <AppText variant="caption" color={colors.accent}>You</AppText> : null}
              </View>
              <View style={styles.stats}>
                <View>
                  <AppText variant="caption" color={colors.textTertiary}>Class</AppText>
                  <StatText style={styles.statSmall}>{w.weight_class ?? '—'}</StatText>
                </View>
                <View>
                  <AppText variant="caption" color={colors.textTertiary}>Weight</AppText>
                  <StatText style={styles.statSmall}>{w.current_weight ?? '—'}</StatText>
                </View>
                <View>
                  <AppText variant="caption" color={colors.textTertiary}>To cut</AppText>
                  <StatText style={[styles.statSmall, { color: onWeight ? colors.success : lbsToCut > 5 ? colors.accent : colors.text }]}>
                    {lbsToCut !== null ? (onWeight ? 'On' : lbsToCut.toFixed(1)) : '—'}
                  </StatText>
                </View>
              </View>
            </Card>
          )
        })
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  myRow: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  statSmall: { fontSize: 20, lineHeight: 24 },
})
