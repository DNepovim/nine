import { isEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import type { PeriodBoard } from '@/hooks/use-board'
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
  digitFont,
}: {
  data: PeriodBoard
  accentColor: string
  userId: string | null
  nickname: string | null
  width: number
  // Resolved once by the parent — 'DSEG7', or `mono` while the face is still loading.
  digitFont: string
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

  // A local row appears only when the device holds more than the server does for this
  // period. Once the flush lands, the two agree and the real row takes over on its own.
  const unpublished =
    data.unpublished === null
      ? null
      : { score: data.unpublished, label: nickname ?? ANONYMOUS_LABEL }
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

  // A rank with no score behind it is `my_rank` counting a player who has never posted
  // as one past the field, so the row below the cut needs a real score to stand on.
  const myRank = data.myRank !== null && data.myRank.best_score > 0 ? data.myRank : null
  // Whether the player is already up there — asked of the rows on screen rather than of
  // the server rank, because a local record can put them on the board while the server
  // still ranks them far down, and they must not appear twice.
  const userIsInTop5 = rows.some((row) => row.isUser)

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
          digitFont={digitFont}
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
              score: data.myBest,
              isUser: true,
              note: data.unpublished === null ? undefined : note,
            }}
            accentColor={accentColor}
            digitFont={digitFont}
          />
        </>
      )}
    </View>
  )
}
