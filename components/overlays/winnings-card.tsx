import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { ProseSentence } from '@/components/overlays/prose-sentence'
import { APP_VIOLET } from '@/constants/colors'
import { totalAwards } from '@/lib/winnings'
import type { AwardBlock } from '@/lib/winnings-announcement'
import { winningsSentences } from '@/lib/winnings-lines'

// What the player won while they were away: the boards they took, what each was taken with,
// and what the lot of it added to their fortune.
//
// Prose rather than the table this used to be. Taking a board is the only thing in the app
// that pays for beating other people rather than for playing, and three columns of figures
// made the one moment that is about rivalry read like a bank statement. The per-board payout
// went with the table — it was the column nobody could add up, and the number that matters
// is the one at the foot.
//
// The accent is APP_VIOLET rather than gold or the achievement green, and deliberately so.
// Gold means a record you *currently hold* and green means an achievement you *keep*;
// winnings are a fourth thing — paid once for a window that has shut, and never taken back —
// so borrowing either would say something untrue. Violet is the app's own hue, for the
// element that belongs to no scale.
//
// No icon square, for the reason RecapCard gives: the two prose pages are not a list to be
// told apart, and a 64pt decoration above two sentences pushes the sentences down for
// nothing.
const ACCENT = APP_VIOLET

export function WinningsCard({ blocks }: { blocks: readonly AwardBlock[] }) {
  // `t` subscribes the card to the active locale, so a language switch re-tells the
  // winnings rather than leaving whichever language they were built in.
  const { t } = useLingui()

  const sentences = winningsSentences(blocks, t)
  const total = totalAwards(blocks.flatMap((block) => block.awards))

  return (
    <View>
      <View className="items-center">
        <Text
          selectable={false}
          className="text-center font-mono text-[17px] font-black tracking-[2px]"
          style={{ color: ACCENT }}
        >
          <Trans>YOU WON</Trans>
        </Text>
      </View>

      <View className="mt-4 gap-2.5">
        {sentences.map((sentence, index) => (
          <ProseSentence key={index} sentence={sentence} />
        ))}
      </View>

      {/* The figure over its label rather than beside it. Read as a row, the two competed:
          a caption as wide as the card put the number it describes out at the far edge,
          where it read as the last item of the list above rather than as its sum. Centred
          and stacked, the number is the thing and the words under it say what it is. */}
      <View className="mt-4 items-center border-t border-muted pt-3">
        <Text
          selectable={false}
          className="font-mono text-[22px] font-black tracking-[1px]"
          style={{ color: ACCENT }}
        >
          +{total.toLocaleString()}
        </Text>
        <Text
          selectable={false}
          className="mt-1 font-mono text-[9px] font-bold tracking-[1px] text-dim"
        >
          <Trans>ADDED TO YOUR FORTUNE</Trans>
        </Text>
      </View>
    </View>
  )
}
