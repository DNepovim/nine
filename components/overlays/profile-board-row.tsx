import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { cn } from '@/lib/cn'
import {
  DIFFICULTIES,
  getDifficultyColor,
  type Difficulty,
  type ScoredMode,
} from '@/modes'

// A number the player has not produced yet. An em dash rather than a zero: a board
// nobody has played is not a board somebody scored nothing on.
const NOTHING = '—'

// The four numeric columns, widest first, so the heading above a row and the row itself
// cannot drift apart — they are the same four strings read twice. Exported for the
// heading in `player-profile-overlay.tsx`, which is the only other place allowed to know
// them.
//
// Deliberately narrow. Four columns plus a spelled difficulty is what fits a 320pt phone
// once the screen's padding and the card's are taken out, and the widths are sized to
// their own contents: a six-figure best score, a four-figure run count, a percentage
// that the speed bonus can push to three digits. The difficulty keeps the slack, because
// it is the one cell whose text changes length with the locale — Czech spells EXTREME
// with two more letters than English does.
export const BOARD_COLUMNS = {
  runs: 'w-10',
  best: 'w-14',
  average: 'w-12',
  bestFactor: 'w-12',
} as const

// One board's line in the profile: what this player has done on one mode × difficulty.
//
// The difficulty is spelled and wears its position along the mode's own gradient, the
// same hue the leaderboard and the medal line give it — so the colour says which board
// without a legend, and the mode header above says which mode.
export function ProfileBoardRow({
  mode,
  difficulty,
  runs,
  best,
  average,
  bestFactor,
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
}) {
  const { t } = useLingui()
  const percent = (value: number | null): string =>
    value === null ? NOTHING : `${value}%`
  return (
    <View className="h-7 flex-row items-center">
      <Text
        selectable={false}
        numberOfLines={1}
        className="flex-1 font-mono text-[10px] font-black tracking-[1px]"
        style={{ color: getDifficultyColor(mode, difficulty) }}
      >
        {t(DIFFICULTIES[difficulty].label)}
      </Text>
      <Text
        selectable={false}
        className={cn(
          BOARD_COLUMNS.runs,
          'text-right font-mono text-[11px] font-bold text-dim',
        )}
      >
        {runs > 0 ? runs : NOTHING}
      </Text>
      {/* The one figure here in full strength. A board's best score is what the row is
          about; the three beside it describe how it was reached. */}
      <Text
        selectable={false}
        className={cn(
          BOARD_COLUMNS.best,
          'text-right font-mono text-[11px] font-bold text-primary',
        )}
      >
        {best ?? NOTHING}
      </Text>
      <Text
        selectable={false}
        className={cn(
          BOARD_COLUMNS.average,
          'text-right font-mono text-[11px] font-bold text-dim',
        )}
      >
        {percent(average)}
      </Text>
      <Text
        selectable={false}
        className={cn(
          BOARD_COLUMNS.bestFactor,
          'text-right font-mono text-[11px] font-bold text-dim',
        )}
      >
        {percent(bestFactor)}
      </Text>
    </View>
  )
}
