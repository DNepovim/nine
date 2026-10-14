import { Trans } from '@lingui/react/macro'
import { Text, View, type StyleProp, type TextStyle } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// What the three columns of a board are called: the rank, the name, the figure.
//
// Its own component because two boards draw the same table and only one of them had
// these. The high-scores panel has carried them since there were boards at all; the
// session board — the standings of one challenge — was drawn by `TabPanel` directly and
// so arrived without them, which left a player reading an unlabelled column of numbers
// on the one screen where the table is unfamiliar.
//
// The widths are the rows': `RANK_COLUMN` below is the literal class string `ScoreRow`
// puts on its own rank cell, and the name sits in a `flex-1` in both. That shared
// constant is the whole reason these line up, and why this is one component rather than
// a copy per caller.
// The rank column, as one class string shared by the header and the rows under it.
//
// Exported and imported rather than written twice, which is the whole point: this column
// has been left-aligned, centred and right-aligned in turn, and each time the header and
// the row were changed separately one of them was missed and the two stopped lining up.
// There is now one place to change and nothing to keep in step.
//
// **Centred**, because the column holds two different shapes — a medal on the first three
// rows, a numeral after them — and the centre is the only anchor both share. Right put the
// medal against the nickname beside it; left put the numerals against the edge.
//
// **Wider than the glyphs need**, which is the air between the medal and the name. There
// is no gap between this column and the next — the name sits in a `flex-1` directly
// after it — so the breathing room has to come from the column itself.
export const RANK_COLUMN = 'w-9 text-center'

export function ScoreColumns({
  glow,
  width,
  className,
}: {
  // The gold screen's text shadow, where these sit straight on the metal with a
  // celebration crossing behind them. A runtime style, so it cannot be a class.
  glow?: StyleProp<TextStyle>
  // The width of the rows these name, where that is not simply the width of whatever
  // they are inside. The challenge dialog's board is held to `min(width - 96, 280)`, and
  // a header spanning the whole card over rows narrower than it is a header whose columns
  // line up with nothing.
  width?: number
  className?: string
}) {
  return (
    <View className={cn('mb-1 flex-row px-2', className)} style={{ width }}>
      <Text
        selectable={false}
        className={cn(TYPE.caption, RANK_COLUMN, 'text-dim')}
        style={glow}
      >
        #
      </Text>
      <Text
        selectable={false}
        className={cn(TYPE.caption, 'flex-1 text-dim')}
        style={glow}
      >
        <Trans>NICK</Trans>
      </Text>
      {/* Right, with the figures. A score column is read down its last digit — the
          numbers are different lengths and their right edges are the only thing they
          have in common — so a label starting where the longest of them starts lines up
          with one row by accident and none on purpose. */}
      <Text
        selectable={false}
        className={cn(TYPE.caption, 'text-right text-dim')}
        style={glow}
      >
        <Trans>SCORE</Trans>
      </Text>
    </View>
  )
}
