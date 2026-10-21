import { Text, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { GLYPH, READOUT, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { formatRaceTime } from '@/lib/duration'
import { groupDigits } from '@/lib/group-digits'
import { rankMedal } from '@/lib/rank-emoji'
import type { SummaryPlace } from '@/lib/session-summary'
import type { Measure } from '@/modes'

// One **place** on a closed session's podium: the medal, the name, the figure.
//
// Two sizes rather than two components. Gold leads the page and the other two stand under
// it, which is the podium drawn as a podium — three equal rows would be a table, and a
// table is what the **session board** already is. The difference is only ever scale: the
// same three parts in the same order, so the eye reads the shape once.
//
// `rankMedal` rather than three emoji typed here. The podium is shared with the board, the
// multiplayer results and the game-over screen, and the one place it lives is
// `lib/rank-emoji.ts` — so the three metals cannot drift apart between the screens that
// draw them.
//
// The name goes through `GradientName`, like every nickname the app writes on its own
// surface: a player is the same colour here as on a leaderboard row and on their own
// profile. The averages ride all the way from the RPC for exactly this — see
// `SummaryPlace`, where they are nullable on purpose.

// What each size is worth, as the roles involved rather than numbers.
//
// The figure is the **seven-segment face**, not the app's mono voice. Everywhere else a
// settled figure is mono and a *live* one is DSEG7 — but this page is a scoreboard being
// read after the fact, and the podium is the one place on it where three numbers are to be
// compared down a column. `READOUT` is the role set for that face.
const SIZES = {
  lead: { medal: GLYPH['4xl'], name: TYPE.cardTitleSm, figure: READOUT.score },
  rest: { medal: GLYPH['3xl'], name: TYPE.labelSm, figure: READOUT.best },
} as const

export type PlaceSize = keyof typeof SIZES

export function SummaryPlaceRow({
  place,
  measure,
  size,
  isMine,
  digitFont,
}: {
  place: SummaryPlace
  // Which of the two figures this session is ordered by. The page prints the one its
  // standings were settled on and never both — see `measureOf`.
  measure: Measure
  size: PlaceSize
  // Whether this place is the reader's own. Drawn as a pill behind the nickname rather
  // than as a word beside it: a name is already the thing the eye is scanning for, and a
  // YOU next to it adds a second thing to read to say what a tint says at a glance. It is
  // also the one mark that cannot collide with a nickname — somebody is called YOU.
  isMine: boolean
  // DSEG7 once it has loaded, the mono voice until then. Resolved by the card above so
  // every figure on the page changes face in the same commit rather than one at a time.
  digitFont: string
}) {
  const type = SIZES[size]
  const figure =
    measure === 'time'
      ? place.timeMs === null
        ? '—'
        : formatRaceTime(place.timeMs)
      : groupDigits(place.score)

  return (
    <View className="items-center gap-0.5">
      <Text selectable={false} className={type.medal}>
        {rankMedal(place.rank)}
      </Text>
      {/* The pill is always the wrapper and only sometimes painted, so a marked name and
          an unmarked one sit at exactly the same height — a background that also moved
          the row would make the podium step whenever the reader was on it.

          `bg-card` is the app's own token for a pill, and one step off the `bg-surface`
          this dialog is drawn on: enough to find at a glance, not enough to shout over
          the medal above it. The name keeps its own colours, which is the point — this
          says *which* of them is yours without repainting it. */}
      <View className={cn('rounded-lg px-2 py-0.5', isMine && 'bg-card')}>
        <GradientName
          nickname={place.nickname}
          avgAccuracy={place.avgAccuracy}
          avgSpeed={place.avgSpeed}
          className={type.name}
          numberOfLines={1}
        />
      </View>
      <Text
        selectable={false}
        className={cn(type.figure, 'text-score')}
        style={{ fontFamily: digitFont }}
      >
        {figure}
      </Text>
    </View>
  )
}
