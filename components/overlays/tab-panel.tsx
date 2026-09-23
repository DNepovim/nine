import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import type { PeriodBoard } from '@/hooks/use-board'
import { useChampionsContext } from '@/hooks/use-champions'
import { championMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { displayRows } from '@/lib/leaderboard-rows'

import { ScoreRow } from './score-row'
import { SkeletonRow } from './skeleton-row'

// What the local row is called before it has a name on the server.
const ANONYMOUS_LABEL = msg`YOU`

// Why the local row is not on the board — a missing nickname is the player's to fix,
// a missing connection is not.
const UNPUBLISHED_NOTE = msg`NOT PUBLISHED`
const UNSYNCED_NOTE = msg`NOT SYNCED`

// What the game-over screen has room for, against the five everywhere else.
const COMPACT_ROWS = 3
const FULL_ROWS = 5

// What the block below the cut costs: the ⋯ and the player's own row, one slot each.
// They come out of the five rather than being added to them — see BODY_HEIGHT.
const CUT_SLOTS = 2

// A ScoreRow is 24px tall, so a board of five stands 120px. Every state of the panel is
// exactly that tall — skeletons, a message, a period holding fewer rows than it has room
// for, and a period showing the player below the cut — because a panel that changes
// height is the whole screen jumping underneath it.
//
// A fixed height, not a minimum. It used to be a minimum, with the row below the cut
// allowed to make the board taller: that is 45px arriving after the skeleton has gone,
// so every player outside the top five watched the board grow and everything under it
// drop. The five slots are now the budget rather than the floor — when the cut block is
// there it takes two of them and three leaders are shown, which is the trade for never
// holding blank space open on the boards where the player is already up top.
const BODY_HEIGHT = 'h-[120px]'
const COMPACT_BODY_HEIGHT = 'h-[72px]'

export function TabPanel({
  data,
  accentColor,
  userId,
  nickname,
  width,
  digitFont,
  halo = false,
  compact = false,
}: {
  data: PeriodBoard
  accentColor: string
  userId: string | null
  nickname: string | null
  width: number
  // Resolved once by the parent — 'DSEG7', or `mono` while the face is still loading.
  digitFont: string
  // Set on the gold game-over screen, where the board sits on the celebration.
  halo?: boolean
  // The game-over screen's short board: three rows, and no row for the player below the
  // cut. Their score is the headline directly above it, so repeating it under a row of
  // dots says nothing and costs the screen two lines it does not have.
  compact?: boolean
}) {
  const { t } = useLingui()
  const champions = useChampionsContext()
  const bodyHeight = compact ? COMPACT_BODY_HEIGHT : BODY_HEIGHT

  if (data.loading) {
    return (
      <View style={{ width }} className={bodyHeight}>
        {Array.from({ length: compact ? COMPACT_ROWS : FULL_ROWS }, (_, i) => (
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
      : { score: data.unpublished, label: nickname ?? t(ANONYMOUS_LABEL) }
  const note = nickname === null ? t(UNPUBLISHED_NOTE) : t(UNSYNCED_NOTE)

  // The board could not be read — offline, most likely. A record held on the device is
  // still the player's, so it stands on its own rather than vanishing with the board;
  // the notice underneath says why it is alone up there.
  const leaders = displayRows(
    data.error === null ? data.rows : [],
    userId,
    unpublished,
    compact ? COMPACT_ROWS : undefined,
  )
  if (data.error !== null && isEmptyArray(leaders)) {
    return (
      <View style={{ width }} className={cn('items-center justify-center', bodyHeight)}>
        <Text selectable={false} className="font-mono text-[9px] font-bold text-dim">
          <Trans>— UNAVAILABLE —</Trans>
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
  const userIsInTop5 = leaders.some((row) => row.isUser)
  // Whether the block below the cut is going to be drawn, decided before the rows are
  // trimmed for it. Asked of the full five: a player outside them cannot be inside the
  // three that are left, so trimming can never change the answer.
  const showCut = !compact && myRank !== null && !userIsInTop5 && nickname !== null
  // The cut block takes two of the five slots, so the leaders give up two. This is what
  // keeps the panel one height whether or not the player is on the board.
  const rows = showCut ? leaders.slice(0, FULL_ROWS - CUT_SLOTS) : leaders

  if (isEmptyArray(rows)) {
    return (
      <View style={{ width }} className={cn('items-center justify-center', bodyHeight)}>
        <Text selectable={false} className="font-mono text-[9px] font-bold text-dim">
          <Trans>— NO SCORES YET —</Trans>
        </Text>
      </View>
    )
  }

  return (
    <View style={{ width }} className={bodyHeight}>
      {rows.map((row) => (
        <ScoreRow
          key={row.key}
          entry={{
            rank: row.rank,
            userId: row.userId,
            mark: championMark(row.userId, champions),
            nickname: row.nickname,
            score: row.score,
            isUser: row.isUser,
            note: row.unpublished ? note : undefined,
            achievedAt: row.achievedAt ?? undefined,
          }}
          accentColor={accentColor}
          digitFont={digitFont}
          halo={halo}
        />
      ))}
      {showCut && (
        <>
          {/* One slot exactly, stated rather than left to font metrics — the same reason
              ScoreRow states its own 24px. Left to the glyph, this row was a couple of
              pixels of its own and the board no longer added up to five. */}
          <View className="h-6 items-center justify-center">
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
              userId,
              mark: championMark(userId, champions),
              nickname,
              score: data.myBest,
              isUser: true,
              note: data.unpublished === null ? undefined : note,
            }}
            accentColor={accentColor}
            digitFont={digitFont}
            halo={halo}
          />
        </>
      )}
    </View>
  )
}
