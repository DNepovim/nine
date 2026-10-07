import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { ARCADE_INK } from '@/constants/colors'
import { gradientOf } from '@/modes'

// What ARCADE says to a player who cannot play it yet.
//
// The pill is on the intro for everyone — it wears SOON, and PLAY GAME under it is dead.
// A tab that does nothing and says nothing is worse than no tab at all: the player has
// been told there is something here and then left to guess what. This is the answer, and
// it stands in the slot Trainee's tips stand in, so the screen's shape does not change
// when the pill is pressed.
//
// Deliberately about the *place* rather than the rules, and deliberately short. Nobody
// needs the scoring of a mode they cannot start — what makes a teaser worth reading is the
// picture it leaves behind, and a picture survives being brief better than a lesson does.

// Arcade's own pair, worn the way ModeTips wears Trainee's: the border held well back so
// it frames the card without competing with the pills above, and the heading in the amber
// the mode's label is already in everywhere else.
//
// Alpha on the colour rather than an `opacity` style, for the same reason ModeTips gives:
// opacity takes the whole subtree down with the border.
const TINT = gradientOf('arcade')[0]
const BORDER_TINT = `${TINT}55`

export function ArcadeTeaser() {
  return (
    <View
      className="gap-2.5 rounded-2xl border px-4 py-4"
      style={{ borderColor: BORDER_TINT }}
    >
      <Text
        selectable={false}
        className="font-mono text-[11px] font-black tracking-[2px]"
        style={{ color: ARCADE_INK }}
      >
        <Trans>COMING SOON</Trans>
      </Text>
      {/* Two sentences and a question. It was four paragraphs explaining the mode, which
          is the wrong thing to hand someone who cannot play it — a teaser is a picture,
          not a manual. The leading is open on purpose: a short card set tight reads as a
          label, and this is meant to be read. */}
      <Text selectable={false} className="font-mono text-[12px] leading-5 text-primary">
        <Trans>
          Same dial, new adventures. Set out on the path of multiplication and conquest.
        </Trans>
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[12px] font-bold leading-5"
        style={{ color: ARCADE_INK }}
      >
        <Trans>How far can you go?</Trans>
      </Text>
    </View>
  )
}
