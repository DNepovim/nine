import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { GLYPH, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { PERIOD_CODES, type Medal } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'
import {
  DIFFICULTIES,
  getDifficultyColor,
  type Difficulty,
  type ScoredMode,
} from '@/modes'

// A number the player has not produced yet. An em dash rather than a zero: a board
// nobody has played is not a board somebody scored nothing on.
const NOTHING = '—'

// How far the medal index sits into the difficulty code rather than clear of it.
// Negative on purpose: a mark set off on its own reads as another column, and tucking it
// against the last letter is what makes the pair read as one thing — the way a
// superscript is set tight to the character it qualifies rather than spaced from it.
//
// In the `style` prop because it goes with the absolute offset beside it, and the pair is
// one measurement.
const BADGE_OVERLAP = -2

// The four numeric columns, widest first, so the heading above a row and the row itself
// cannot drift apart — they are the same four strings read twice. Exported for the
// heading in `player-profile-overlay.tsx`, which is the only other place allowed to know
// them.
//
// Sized to their headings rather than to their figures, which is the thing that changed
// when the difficulty went to a code. Every figure here is comfortably shorter than the
// word over it: a six-figure best score is four fifths of `best`, and a percentage the
// speed bonus pushed to three digits is half of `average`. The heading is what decides,
// and the heading is where the locale bites — BEST is NEJLEPŠÍ in Czech, eight characters
// stacked over two of these columns, and `w-12` is what holds it.
//
// `runs` is the one exception, because HRY and RUNS are both short and a run count past
// five figures is not a thing a board has seen.
export const BOARD_COLUMNS = {
  runs: 'w-9',
  best: 'w-12',
  average: 'w-12',
  bestFactor: 'w-12',
} as const

// One board's line in the profile: what this player has done on one mode × difficulty.
//
// The difficulty is a code wearing its position along the mode's own gradient, the same
// hue the leaderboard and the medal line give it — so the colour says which board
// without a legend, and the mode code above says which mode. Clipped rather than
// spelled, to the same three letters the medal line and the reign rows use: a column of
// ESY / HRD / EXT is read by its shape in one glance where EASY / HARD / EXTREME is read
// as three words, and it is the only cell on the row that was ever asked to give way.
export function ProfileBoardRow({
  mode,
  difficulty,
  runs,
  best,
  average,
  bestFactor,
  medals,
}: {
  mode: ScoredMode
  difficulty: Difficulty
  runs: number
  best: number | null
  // Accuracy on an Accuracy board, speed on a Speed board, already a percentage.
  average: number | null
  // The same factor at its best rather than on average, already a percentage. Null on a
  // board whose runs all predate the server keeping one.
  bestFactor: number | null
  // What the player holds on this board, best claim first. Empty on most of them.
  medals: readonly Medal[]
}) {
  const { t } = useLingui()
  const percent = (value: number | null): string =>
    value === null ? NOTHING : `${value}%`
  return (
    <View className="h-7 flex-row items-center">
      {/* The difficulty and, hung off its top right, what the player holds here. A board
          is one mode × difficulty, so this row is the only place a medal can be put
          where it says which board it was won on without naming it again.

          The medals are out of the flow entirely, which is the whole of what makes this
          fit. In the row they were a cell of their own in all but name, and on a narrow
          phone the four fixed columns leave this one barely wider than its three letters
          — so the badges took the width and the code was what got cut. Out of the flow
          they cost nothing: the code has the cell to itself, and the badges lie over the
          gap between it and the right-aligned figures, which is empty on every row. */}
      <View className="flex-1 flex-row items-center">
        {/* `shrink-0` because on the web build a flex child shrinks by default where on
            native it does not, and this is the one box in the row that must not. */}
        <View className="shrink-0">
          <Text
            selectable={false}
            numberOfLines={1}
            className={cn(TYPE.label, 'leading-[16px]')}
            style={{ color: getDifficultyColor(mode, difficulty) }}
          >
            {t(DIFFICULTIES[difficulty].code)}
          </Text>
          {/* Anchored to the code's own right edge rather than the cell's, so it reads
              as an index on those three letters wherever they end, and tucked back over
              the last of them so the two read as one mark rather than as a code and a
              medal that happen to be adjacent. Raised above them by the gap between the
              two line boxes: the badge's is 9pt inside the code's 16pt, and sitting it at
              the top is what sets it as an index rather than as a fourth figure on the
              line. */}
          <View
            pointerEvents="none"
            className="absolute flex-row items-center gap-1"
            style={{ top: -1, left: '100%', marginLeft: BADGE_OVERLAP }}
          >
            {medals.map((medal) => (
              <View key={medal.period} className="flex-row items-center gap-0.5">
                <Text selectable={false} className={cn(GLYPH['3xs'], 'leading-[9px]')}>
                  {rankMedal(medal.rank)}
                </Text>
                {/* Which window it stands on, in the same clipped code and the same dim
                    the medal line sets it in — the metal is the claim, the window is the
                    qualifier, and a medal without one reads as all-time. */}
                <Text
                  selectable={false}
                  className={cn(TYPE.kicker, 'leading-[9px] text-dim')}
                >
                  {PERIOD_CODES[medal.period]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Text
        selectable={false}
        className={cn(BOARD_COLUMNS.runs, TYPE.figure, 'text-right text-dim')}
      >
        {runs > 0 ? runs : NOTHING}
      </Text>
      {/* The one figure here in full strength. A board's best score is what the row is
          about; the three beside it describe how it was reached. */}
      <Text
        selectable={false}
        className={cn(BOARD_COLUMNS.best, TYPE.figure, 'text-right text-primary')}
      >
        {best ?? NOTHING}
      </Text>
      <Text
        selectable={false}
        className={cn(BOARD_COLUMNS.average, TYPE.figure, 'text-right text-dim')}
      >
        {percent(average)}
      </Text>
      <Text
        selectable={false}
        className={cn(BOARD_COLUMNS.bestFactor, TYPE.figure, 'text-right text-dim')}
      >
        {percent(bestFactor)}
      </Text>
    </View>
  )
}
