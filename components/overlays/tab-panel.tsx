import { isEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import type { LeaderboardState } from '@/hooks/use-leaderboard'
import { displayRows } from '@/lib/leaderboard-rows'

import { ScoreRow } from './score-row'
import { SkeletonRow } from './skeleton-row'

// What the local row is called before it has a name on the server.
const ANONYMOUS_LABEL = 'YOU'

// Why the local row is not on the board — a missing nickname is the player's to fix,
// a missing connection is not.
const UNPUBLISHED_NOTE = 'NOT PUBLISHED'
const UNSYNCED_NOTE = 'NOT SYNCED'

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
  // The player's best local score for this period, when it has yet to reach the board.
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

  const unpublished =
    unpublishedScore === null
      ? null
      : { score: unpublishedScore, label: nickname ?? ANONYMOUS_LABEL }
  const note = nickname === null ? UNPUBLISHED_NOTE : UNSYNCED_NOTE

  // The board could not be read — offline, most likely. A record held on the device is
  // still the player's, so it stands on its own rather than vanishing with the board;
  // the notice underneath says why it is alone up there.
  const rows = displayRows(data.error === null ? data.rows : [], userId, unpublished)
  if (data.error !== null && isEmptyArray(rows)) {
    return (
      <View style={{ width }} className="items-center py-4">
        <Text selectable={false} className="font-mono text-[9px] font-bold text-dim">
          — UNAVAILABLE —
        </Text>
      </View>
    )
  }

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
            note: row.unpublished ? note : undefined,
            achievedAt: row.achievedAt ?? undefined,
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
