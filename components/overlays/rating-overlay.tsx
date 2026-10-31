import { Trans } from '@lingui/react/macro'
import { useRef } from 'react'
import { Text, View } from 'react-native'
import { interpolateColor } from 'react-native-reanimated'

import { LinkButton } from '@/components/link-button'
import { ChallengeName } from '@/components/overlays/challenge-name'
import { CodeKeyboard, type KeyPaint } from '@/components/overlays/code-keyboard'
import { ModalCard } from '@/components/overlays/modal-card'
import { DIAL_COLORS } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { isRating, type Rating } from '@/lib/session-rating'
import type { SessionSummary } from '@/lib/session-summary'
import { darkGradientOf, gradientOf } from '@/modes'

// The two ends, as faces on their own keys: 1 is NOT FOR ME and 9 is MORE OF THIS. A
// face says how the player felt where a caption under the keypad only said which number
// meant it, and the seven keys between are left as digits — a scale of nine faces is a
// row of emoji to tell apart, and the middle is a matter of degree.
const ENDS = { 1: '😣', 9: '😍' } as const

// A key wears what a dial key wears at the same value: 1 to 8 up the dial's own ramp, from
// pale to blue, and 9 in the challenge's dark gradient with the warm digit — the same
// split `DialButton` makes, so the keypad reads as the dial the player has just been
// playing on, warming towards the answer that liked it most. The ramp runs to 8 there and
// here, so a 1 sits an eighth of the way up rather than on the palest end.
const RAMP_MAX = 8

const dialPaint =
  (modeId: string) =>
  (key: number): KeyPaint => {
    if (key === 9) return { fill: darkGradientOf(modeId), ink: DIAL_COLORS.peakText }
    const tint = interpolateColor(
      key / RAMP_MAX,
      [0, 1],
      [DIAL_COLORS.low, DIAL_COLORS.high],
    )
    return { fill: [tint, tint], ink: DIAL_COLORS.text }
  }

// The **rating**: how was the session the player has just been told the summary of.
//
// Asked on a keypad of nine because the game is a dial of nine — the player answers the
// way they played. One tap answers and the dialog goes: there is no SEND, because a
// question this small should cost one press, and the dial's colours on every key already
// say which end is which before anything is pressed.
//
// Its own dialog rather than a last page of the launch popup, because the popup is
// dismissed as a whole and every page on it is "shown" the moment it opens — a question
// on a page somebody skipped past with the dots would have been asked without being seen.
export function RatingOverlay({
  summary,
  onSend,
  onDismiss,
}: {
  summary: SessionSummary
  onSend: (rating: Rating) => void
  // Called once the card has gone, however it went — a key, NOT NOW or the header close.
  onDismiss: () => void
}) {
  // Whether a key has already answered. The card stays pressable for the length of its
  // exit, and a second tap there would write twice — the second time perhaps another key.
  const sent = useRef(false)

  return (
    <ModalCard
      edge={gradientOf(summary.modeId)}
      closeButton={false}
      onDismiss={onDismiss}
    >
      {(close) => (
        <View className="items-center">
          {/* The question first and the challenge under it: the name says which contest,
              but what the card is for is the question. */}
          <Text selectable={false} className={cn(TYPE.cardTitle, 'text-center')}>
            <Trans>HOW DO YOU LIKE THE CHALLENGE?</Trans>
          </Text>
          <ChallengeName
            modeId={summary.modeId}
            className={cn(TYPE.screenTitle, 'mt-2')}
          />

          <CodeKeyboard
            id="rating.key"
            keyPaint={dialPaint(summary.modeId)}
            faces={ENDS}
            onKey={(key) => {
              if (!isRating(key) || sent.current) return
              sent.current = true
              onSend(key)
              close()
            }}
          />

          <LinkButton
            id="rating.dismiss"
            className="mt-5"
            icon="close-outline"
            label={<Trans>NOT NOW</Trans>}
            onPress={close}
          />
        </View>
      )}
    </ModalCard>
  )
}
