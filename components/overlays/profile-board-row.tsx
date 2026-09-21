import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { DIFFICULTIES, getDifficultyColor } from '@/machines/game'
import type { Difficulty, ScoredMode } from '@/machines/modes'

// A number the player has not produced yet. An em dash rather than a zero: a board
// nobody has played is not a board somebody scored nothing on.
const NOTHING = '—'

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
}: {
  mode: ScoredMode
  difficulty: Difficulty
  runs: number
  best: number | null
  // Accuracy on an Accuracy board, speed on a Speed board, already a percentage.
  average: number | null
}) {
  const { t } = useLingui()
  return (
    <View className="h-7 flex-row items-center">
      <Text
        selectable={false}
        className="flex-1 font-mono text-[10px] font-black tracking-[1px]"
        style={{ color: getDifficultyColor(mode, difficulty) }}
      >
        {t(DIFFICULTIES[difficulty].label)}
      </Text>
      <Text
        selectable={false}
        className="w-14 text-right font-mono text-[11px] font-bold text-dim"
      >
        {runs > 0 ? runs : NOTHING}
      </Text>
      <Text
        selectable={false}
        className="w-20 text-right font-mono text-[11px] font-bold text-primary"
      >
        {best ?? NOTHING}
      </Text>
      <Text
        selectable={false}
        className="w-16 text-right font-mono text-[11px] font-bold text-dim"
      >
        {average === null ? NOTHING : `${average}%`}
      </Text>
    </View>
  )
}
