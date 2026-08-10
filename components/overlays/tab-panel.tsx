import { isEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import type { LeaderboardState } from '@/hooks/use-leaderboard'
import { displayRows } from '@/lib/leaderboard-rows'

import { ScoreRow } from './score-row'
import { SkeletonRow } from './skeleton-row'

// Label the unpublished row carries in the nickname column.
const UNPUBLISHED_LABEL = 'YOU'

export function TabPanel({
  data,
  accentColor,
  userId,
  nickname,
  width,
  unpublishedScore,
}: {
  data: LeaderboardState
  accentColor: string
  userId: string | null
  nickname: string | null
  width: number
  // The player's best local score for this period, when it has yet to be published.
  unpublishedScore: number | null
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

  const unpublished =
    unpublishedScore === null
      ? null
      : { score: unpublishedScore, label: UNPUBLISHED_LABEL }
  const rows = displayRows(data.rows, userId, unpublished)
  const myRank = data.myRank
  const userIsInTop5 = myRank !== null && myRank.rank <= rows.length

  if (isEmptyArray(rows)) {
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
      {rows.map((row) => (
        <ScoreRow
          key={row.key}
          entry={{
            rank: row.rank,
            nickname: row.nickname,
            score: row.score,
            isUser: row.isUser,
            unpublished: row.unpublished,
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
