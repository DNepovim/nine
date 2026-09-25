import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { CompareValue } from '@/components/overlays/compare-value'
import { toneFor, type CompareSide } from '@/lib/compare'
import { DIFFICULTIES, getDifficultyColor } from '@/machines/game'
import type { Difficulty, ScoredMode } from '@/machines/modes'

// A board neither side has posted on. The same em dash `ProfileBoardRow` uses, and it means
// the same thing here: nobody has played it, which is not the same as scoring nothing.
const NOTHING = '—'

// One board's line in the comparison table: the two best scores on it, side by side.
//
// The difficulty is spelled and wears its position along the mode's own gradient, exactly
// as `ProfileBoardRow` draws it one card behind this one — so a board is the same colour
// whichever of the two tables the player is reading.
export function CompareBoardRow({
  mode,
  difficulty,
  mine,
  theirs,
  leader,
}: {
  mode: ScoredMode
  difficulty: Difficulty
  // Best score on this board, or null for a side that has never posted one.
  mine: number | null
  theirs: number | null
  leader: CompareSide
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
      <CompareValue
        text={mine === null ? NOTHING : String(mine)}
        tone={toneFor(leader, 'mine')}
      />
      <CompareValue
        text={theirs === null ? NOTHING : String(theirs)}
        tone={toneFor(leader, 'theirs')}
      />
    </View>
  )
}
