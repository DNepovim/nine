import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { useRef } from 'react'
import { Text, View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ModalCard } from '@/components/overlays/modal-card'
import { TrackedPressable } from '@/components/tracked-pressable'
import { GLYPH, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { WELCOME_BOARD } from '@/lib/welcome'
import { darkGradientOf } from '@/modes'

// The same cap the tutorial ends on, so the two cards read as the two ends of one lesson.
const MARK = '🎓'

// What a first launch asks over the intro: the tutorial, offered rather than dealt.
//
// The first launch used to open straight into the lesson. It opens on the intro now, so
// the player sees where they are before anything starts, and this card is the one thing
// standing over it. START TUTORIAL deals the same run the guide's TRY IT does; NOT NOW
// leaves them on the intro, and the guide's TRY IT is still there later.
//
// The sibling of `TutorialDoneModal`, in its layout and its voice: a mark, two short lines,
// one button and a quiet way out.
export function TutorialOfferModal({
  onAccept,
  onDismiss,
}: {
  onAccept: () => void
  // Closed without taking it, by NOT NOW or by the scrim.
  onDismiss: () => void
}) {
  // Which way the card was answered, read once the exit animation has played. Accepting
  // starts a run behind the card, and cutting the card off at the press would halve its exit.
  const accepted = useRef(false)

  return (
    <ModalCard
      closeButton={false}
      onDismiss={() => {
        if (accepted.current) onAccept()
        else onDismiss()
      }}
    >
      {(close) => (
        <View className="items-center pb-1 pt-2">
          <Text
            selectable={false}
            className={cn(GLYPH['3xl'], 'mb-2 text-center leading-[32px]')}
          >
            {MARK}
          </Text>
          <Text
            selectable={false}
            className={cn(TYPE.button, 'mb-1.5 text-center text-primary')}
          >
            <Trans>New here?</Trans>
          </Text>
          <Text
            selectable={false}
            className={cn(TYPE.prose, 'mb-5 text-center text-dim')}
          >
            <Trans>A short tutorial shows every move.</Trans>
          </Text>

          <TrackedPressable
            id="tutorial_offer.accept"
            onPress={() => {
              accepted.current = true
              close()
            }}
            className="w-full overflow-hidden rounded-xl"
          >
            <LinearGradient
              colors={[...darkGradientOf(WELCOME_BOARD.mode)]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="items-center py-3.5"
            >
              <Text
                selectable={false}
                numberOfLines={1}
                className={cn(TYPE.button, 'text-on-strong')}
              >
                <Trans>START TUTORIAL</Trans>
              </Text>
            </LinearGradient>
          </TrackedPressable>

          <LinkButton
            id="tutorial_offer.dismiss"
            onPress={close}
            icon="close-outline"
            label={<Trans>NOT NOW</Trans>}
            className="mt-1 w-full py-3"
          />
        </View>
      )}
    </ModalCard>
  )
}
