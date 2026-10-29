import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { Text, View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ChallengeName } from '@/components/overlays/challenge-name'
import { CodeKeyboard } from '@/components/overlays/code-keyboard'
import { ModalCard } from '@/components/overlays/modal-card'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { isRating, type Rating } from '@/lib/session-rating'
import type { SessionSummary } from '@/lib/session-summary'
import { gradientOf } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// The **rating**: how was the session the player has just been told the summary of.
//
// Asked on a keypad of nine because the game is a dial of nine — the player answers the
// way they played. One press chooses and a second press moves the choice; SEND is what
// answers, so a slipped thumb is not a verdict. Only the two ends are named: a scale with
// nine labels is a form, and this is meant to take a second.
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
  // Called once the card has gone, however it went — SEND, NOT NOW or the header close.
  onDismiss: () => void
}) {
  const [chosen, setChosen] = useState<Rating | null>(null)
  // Whether SEND has already answered. The card stays pressable for the length of its
  // exit, and a double tap there would write twice — the second time perhaps another key.
  const sent = useRef(false)
  // The challenge's pair on the border, and on the keys walked down to the shade that
  // carries a digit — see `challengeInk`. The first stop is the near-black every challenge
  // shares, so the resting keys and their digits read the same on every challenge; the
  // hue is in the second stop, and so in the chosen key, which wears the pair in full.
  const edge = gradientOf(summary.modeId)
  const keys: [string, string] = [challengeInk(edge[0]), challengeInk(edge[1])]

  return (
    <ModalCard edge={edge} closeButton={false} onDismiss={onDismiss}>
      {(close) => (
        <View className="items-center">
          <ChallengeName modeId={summary.modeId} className={TYPE.screenTitle} />
          <Text selectable={false} className={cn(TYPE.labelSm, 'mt-1.5 text-dim')}>
            <Trans>HOW WAS THIS ONE?</Trans>
          </Text>

          <CodeKeyboard
            id="rating.key"
            accentColors={keys}
            lit={chosen}
            onKey={(key) => {
              if (isRating(key)) setChosen(key)
            }}
          />

          {/* The two ends, under the keys they sit nearest: 1 top left, 9 bottom right. */}
          <View className="mt-3 w-full flex-row justify-between">
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              <Trans>1 = NOT FOR ME</Trans>
            </Text>
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              <Trans>9 = MORE OF THIS</Trans>
            </Text>
          </View>

          <PrimaryButton
            id="rating.send"
            className="mt-5 self-stretch"
            disabled={chosen === null}
            label={<Trans>SEND</Trans>}
            onPress={() => {
              if (chosen === null || sent.current) return
              sent.current = true
              onSend(chosen)
              close()
            }}
          />
          <LinkButton
            id="rating.dismiss"
            className="mt-3"
            icon="close-outline"
            label={<Trans>NOT NOW</Trans>}
            onPress={close}
          />
        </View>
      )}
    </ModalCard>
  )
}
