import { Trans } from '@lingui/react/macro'
import { Text } from 'react-native'

import { CompareRow } from '@/components/overlays/compare-row'
import { CompareValue } from '@/components/overlays/compare-value'
import { toneFor, type CompareSide } from '@/lib/compare'

// What the six boards above it came to: how many of them each side takes.
//
// The figure used to sit under the two nicknames in the header, where it counted the career
// rows as well and so could not be checked against anything in front of the reader. Here it
// is a sum of the rows directly above it — the one thing a reader can verify by counting the
// carets — and it is drawn as one: ruled off, labelled, in the same two columns.
//
// The whole table's score is not a number any more. It is the sentence under the header,
// which is where a figure covering ten rows of two different kinds belongs.
export function CompareWonRow({
  // How many boards each side leads. Boards neither has played count for neither, so the two
  // need not add up to six.
  mine,
  theirs,
  index,
}: {
  mine: number
  theirs: number
  index: number
}) {
  // Judged like every other row on the card, by the same function, so the caret on a total
  // means what a caret means everywhere above it. A draw leaves both sides plain.
  const leader: CompareSide = mine === theirs ? null : mine > theirs ? 'mine' : 'theirs'
  return (
    <CompareRow index={index} ruled>
      {/* Brighter than the board labels above it, which sit in their difficulty's colour,
          and heavier than the career block's dim stat names: this row is the answer and
          they are the working. */}
      <Text
        selectable={false}
        numberOfLines={1}
        className="flex-1 font-mono text-[9px] font-black tracking-[1px] text-primary"
      >
        <Trans>WON</Trans>
      </Text>
      <CompareValue text={String(mine)} tone={toneFor(leader, 'mine')} />
      <CompareValue text={String(theirs)} tone={toneFor(leader, 'theirs')} />
    </CompareRow>
  )
}
