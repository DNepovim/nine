import { useLingui } from '@lingui/react/macro'
import { Text } from 'react-native'

import { CompareRow } from '@/components/overlays/compare-row'
import { CompareValue } from '@/components/overlays/compare-value'
import { toneFor, type CompareSide } from '@/lib/compare'
import {
  codeOf,
  DIFFICULTIES,
  getDifficultyColor,
  type Difficulty,
  type ScoredMode,
} from '@/modes'

// A board neither side has posted on. The same em dash `ProfileBoardRow` uses, and it means
// the same thing here: nobody has played it, which is not the same as scoring nothing.
const NOTHING = '—'

// One board's line in the comparison table: the two best scores on it, side by side.
//
// Written as a code — `ACC EXT` — exactly as `ProfileReignRow` writes a board one card
// behind this one. The table used to spell the difficulty under a heading naming the mode,
// which cost two heading rows out of a card that has thirteen rows to fit; the code says
// both things in seven characters, so all six boards sit in one block with nothing over
// them.
//
// One colour across the pair rather than a colour each. `getDifficultyColor` is the mode's
// own gradient read at the difficulty's position along it, so a single hue already carries
// both halves of what the code says — ACC EXT is the far end of accuracy's pair, SPD ESY the
// near end of speed's. Two colours on one label would be inventing a distinction the scale
// already makes.
export function CompareBoardRow({
  mode,
  difficulty,
  // Best score on this board, or null for a side that has never posted one.
  mine,
  theirs,
  leader,
  index,
}: {
  mode: ScoredMode
  difficulty: Difficulty
  mine: number | null
  theirs: number | null
  leader: CompareSide
  index: number
}) {
  const { t } = useLingui()
  return (
    <CompareRow index={index}>
      <Text
        selectable={false}
        numberOfLines={1}
        className="flex-1 font-mono text-[10px] font-black tracking-[1px]"
        style={{ color: getDifficultyColor(mode, difficulty) }}
      >
        {`${t(codeOf(mode))} ${t(DIFFICULTIES[difficulty].code)}`}
      </Text>
      <CompareValue
        text={mine === null ? NOTHING : String(mine)}
        tone={toneFor(leader, 'mine')}
      />
      <CompareValue
        text={theirs === null ? NOTHING : String(theirs)}
        tone={toneFor(leader, 'theirs')}
      />
    </CompareRow>
  )
}
