import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { cn } from '@/lib/cn'
import { formatShortDate, formatShortDay } from '@/lib/format-date'
import { PERIOD_CODES } from '@/lib/medals'
import type { BoardPeriod } from '@/lib/player-profile'
import { rankMedal } from '@/lib/rank-emoji'
import {
  codeOf,
  DIFFICULTIES,
  getDifficultyColor,
  type Difficulty,
  type ScoredMode,
} from '@/modes'

// Every row here is rank one. Holding a board and leading it are the same fact, so there
// is no silver in this list to tell a gold apart from — which is why the column is one
// mark rather than a metal that varies.
//
// Through `rankMedal` all the same, so the podium stays defined in one place. The `?? ''`
// is only because it answers for any number and cannot know that this one is on the
// podium.
const GOLD = rankMedal(1) ?? ''

// Which formatter each period's dates need, and the reason the row has to ask at all: an
// all-time board changes hands on an instant and carries a timestamp, while a day and a
// week are won by the calendar and carry a bare ISO day. `formatShortDay` parses that by
// hand because `Date` would read it as UTC and shift it a day backwards for anyone west
// of Greenwich — and a day that is the whole subject of the line is the worst one to be
// off by one.
const FORMAT_DATE = {
  day: formatShortDay,
  week: formatShortDay,
  ever: formatShortDate,
} as const satisfies Record<BoardPeriod, (iso: string) => string>

// How long the board was, in the same clipped codes the medal line under the title uses —
// read from `PERIOD_CODES` rather than written again, so the two cannot drift. They are
// drawn on the same card: the line says ALL above, and this list says ALL below.
//
// Keyed by `BoardPeriod` rather than by `MedalPeriod`, which is the one difference. A
// finished stretch is described by how long its board was, never by `'today'`.
const PERIOD_CODE = {
  day: PERIOD_CODES.today,
  week: PERIOD_CODES.week,
  ever: PERIOD_CODES.ever,
} as const satisfies Record<BoardPeriod, string>

// One unbroken stretch of holding a board, on the profile's MEDALS HELD, EVER list.
//
// Three columns, and the order is the question being answered: what they took, which
// board they took it on, and when it was theirs. The medal leads because the list is of
// medals; the board is a code rather than prose because three of them spelled out is
// what crowded the dates off a narrow phone; the stretch comes last because it is the
// only column that varies in length.
//
// Open and closed stretches are the same row with a different tail: `SINCE 12 AUG` while
// it is still theirs, `12 AUG – 3 SEP` once somebody took it, and a bare `14 SEP` where
// it began and ended on the same day. The open one keeps the primary ink, so a live
// stretch reads as a standing rather than as history.
export function ProfileReignRow({
  mode,
  difficulty,
  period,
  from,
  to,
}: {
  mode: ScoredMode
  difficulty: Difficulty
  period: BoardPeriod
  from: string
  // Null while they still hold it — the distinction the whole list is about. Only an
  // all-time board can be open; a day and a week both end on a clock.
  to: string | null
}) {
  const { t } = useLingui()
  const date = FORMAT_DATE[period]
  // Three tails rather than two. The single-day case is not a range of one day to
  // itself — a day board won once was held for that day, and `14 SEP – 14 SEP` asks the
  // reader to notice the two halves are the same before it says anything.
  const span =
    to === null
      ? t`SINCE ${date(from)}`
      : from === to
        ? date(from)
        : `${date(from)} – ${date(to)}`

  return (
    <View className="h-7 flex-row items-center gap-2">
      <Text selectable={false} className="text-[11px] leading-[13px]">
        {GOLD}
      </Text>
      {/* Board then period, one shade apart — the same pairing the medal line draws, for
          the same reason: the board is what was held and wears its own colour, the period
          is the qualifier and sits back in dim, so a glance reads the boards before it
          reads the windows. */}
      <View className="flex-1 flex-row items-center gap-1">
        <Text
          selectable={false}
          numberOfLines={1}
          className="font-mono text-[10px] font-black tracking-[1px]"
          style={{ color: getDifficultyColor(mode, difficulty) }}
        >
          {`${t(codeOf(mode))} ${t(DIFFICULTIES[difficulty].code)}`}
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[8px] font-bold tracking-[0.5px] text-dim"
        >
          {PERIOD_CODE[period]}
        </Text>
      </View>
      <Text
        selectable={false}
        numberOfLines={1}
        className={cn(
          'w-28 text-right font-mono text-[9px] font-bold tracking-[0.5px]',
          to === null ? 'text-primary' : 'text-dim',
        )}
      >
        {span}
      </Text>
    </View>
  )
}
