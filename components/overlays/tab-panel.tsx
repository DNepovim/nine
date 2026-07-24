import { Text, View } from 'react-native'

import type { LeaderboardState } from '@/hooks/use-leaderboard'

import { ScoreRow } from './score-row'
import { SkeletonRow } from './skeleton-row'

export function TabPanel({
  data,
  accentColor,
  userId,
  nickname,
  width,
}: {
  data: LeaderboardState
  accentColor: string
  userId: string | null
  nickname: string | null
  width: number
}) {
  if (data.loading) {
    return (
      <View style={{ width }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    )
  }

  if (data.error) {
    return (
      <View style={{ width }} className="items-center py-4">
        <Text selectable={false} className="font-mono text-[9px] font-bold text-dim">
          — UNAVAILABLE —
        </Text>
      </View>
    )
  }

  const top5 = data.rows
  const myRank = data.myRank
  const userIsInTop5 = myRank !== null && myRank.rank <= top5.length

  if (top5.length === 0) {
    return (
      <View style={{ width }} className="items-center py-4">
        <Text selectable={false} className="font-mono text-[9px] font-bold text-dim">
          — NO SCORES YET —
        </Text>
      </View>
    )
  }

  return (
    <View style={{ width }}>
      {top5.map((row) => (
        <ScoreRow
          key={row.user_id}
          entry={{
            rank: row.rank,
            nickname: row.nickname,
            score: row.best_score,
            isUser: row.user_id === userId,
          }}
          accentColor={accentColor}
        />
      ))}
      {myRank !== null && !userIsInTop5 && nickname !== null && (
        <>
          <View className="items-center py-1">
            <Text
              selectable={false}
              className="font-mono text-[11px] tracking-[6px] text-dim"
            >
              ⋯
            </Text>
          </View>
          <ScoreRow
            entry={{
              rank: myRank.rank,
              nickname,
              score: myRank.best_score,
              isUser: true,
            }}
            accentColor={accentColor}
          />
        </>
      )}
    </View>
  )
}
