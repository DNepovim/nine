import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { ProseSentence } from '@/components/overlays/prose-sentence'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { groupDigits } from '@/lib/group-digits'
import { totalAwards } from '@/lib/winnings'
import type { AwardBlock } from '@/lib/winnings-announcement'
import { winningsSentences } from '@/lib/winnings-lines'

// What the player placed on while they were away: the boards, what each was placed with,
// and what the lot of it is worth.
//
// Prose rather than the table this used to be. Taking a board is the only thing in the app
// that pays for beating other people rather than for playing, and three columns of figures
// made the one moment that is about rivalry read like a bank statement. The per-board payout
// went with the table — it was the column nobody could add up, and the number that matters
// is the one at the foot.
//
// **No title of its own.** The dialog's own heading asks the question this card answers —
// see `popupTitle` — and a second heading under it was the card saying in three words what
// the page above it had just said in four.
//
// **No rule above the figure, either.** A hairline earns its place when it separates two
// things of the same kind; here it was fencing a number off from the sentences that explain
// it, and the air does that better.
//
// The figure is the app's own mono voice at headline size — `TYPE.figureLarge` — in
// `--color-fortune`, the one colour a fortune is ever written in. It wore the seven-segment
// face for a moment and should not: DSEG7 is the scoreboard over a live run, and a reward
// is not being counted in front of anybody.
//
// The colour is the game scale's red, darkened to carry text. A fortune is every point a
// player has ever scored, across every mode — which is what the game scale is for, where a
// mode's own colour would be a claim about one of them. It is deliberately neither the
// score green (that token belongs to a *score*, and three of its six call sites are live
// readouts) nor the achievement green, which `ACHIEVEMENT_SCALE` keeps for the one thing it
// means.
//
// Darkened for two reasons rather than one. `APP_RED` at full strength is 2.9:1 on a card
// and could not carry a figure at all — but it is also the app's colour for something going
// *wrong*: a mistyped game code, and a life coming off. A fortune only ever grows, so it
// must not arrive in the hue that means you just lost something. At this depth it reads as
// its own colour rather than as that one.

export function WinningsCard({
  blocks,
  accepted,
}: {
  blocks: readonly AwardBlock[]
  // Whether the dialog's button has been pressed. Until it has, the figure is waiting
  // rather than paid — which is the whole difference between this card and the one it
  // replaced, and the only thing on it that changes.
  accepted: boolean
}) {
  // `t` subscribes the card to the active locale, so a language switch re-tells the
  // winnings rather than leaving whichever language they were built in.
  const { t } = useLingui()

  const sentences = winningsSentences(blocks, t)
  const total = totalAwards(blocks.flatMap((block) => block.awards))

  return (
    <View>
      <View className="gap-2.5">
        {sentences.map((sentence, index) => (
          <ProseSentence key={index} sentence={sentence} />
        ))}
      </View>

      {/* The figure over its words rather than beside them. Read as a row, the two
          competed: a caption as wide as the card put the number it describes out at the far
          edge, where it read as the last item of the list above rather than as its sum.
          Centred and stacked, the number is the thing and the words under it say what it is.

          The words are the one thing the press changes. The figure does not move: it is
          what these windows came to either way, and a number that jumped on being accepted
          would read as a different number rather than as the same one, now paid.

          Grouped with `groupDigits` rather than `toLocaleString`, whose separator is a
          comma in English and the decimal point in Czech — a figure that meant one thing on
          one phone and something else on another. The helper's no-break space is correct in
          both. */}
      <View className="mt-5 items-center">
        <Text selectable={false} className={cn(TYPE.figureLarge, 'text-fortune')}>
          {groupDigits(total)}
        </Text>
        <Text selectable={false} className={cn(TYPE.labelSm, 'mt-1.5 text-dim')}>
          {accepted ? (
            <Trans>ADDED TO YOUR FORTUNE</Trans>
          ) : (
            <Trans>IS WAITING FOR YOU</Trans>
          )}
        </Text>
      </View>
    </View>
  )
}
