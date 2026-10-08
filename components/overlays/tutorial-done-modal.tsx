import { Trans, useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { useRef } from 'react'
import { Text, View } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import { TrackedPressable } from '@/components/tracked-pressable'
import { GLYPH, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { darkGradientOf, labelOf, type ModeId } from '@/modes'

// The mark over the words. A cap rather than the toast's flame: that one speaks for a
// streak the player happened to be on, and this one for a tutorial behind them — the
// only thing the tutorial has to congratulate anybody for.
const MARK = '🎓'

// What the tutorial says once it has nothing left to teach: a real game, now.
//
// A dialog rather than the toast the practice run floats, and that is the difference
// between the two offers. The toast arrives mid-practice, interrupts a player who is busy
// and has to be refusable at a glance; this one arrives on a taught run with no clock on
// it, where nothing is lost by stopping.
//
// It names the mode and no more. Which board it is — Accuracy on Easy — is the next
// screen's to show, where there is room for the badges to say it properly.
//
// No title either, for the reason the profile card has none: the card is three short
// lines and a button, and a label over them would be saying a fourth time what they
// already say. The header row stays — it is what holds the way out.
export function TutorialDoneModal({
  mode,
  onAccept,
  onDismiss,
}: {
  // The mode being offered, so the button can name it.
  mode: ModeId
  onAccept: () => void
  // Closed without an answer, by NOT NOW or by the header's own dot. The practice run
  // carries on underneath either way.
  onDismiss: () => void
}) {
  const { t } = useLingui()
  // Named rather than inlined, so the translated line can put the mode wherever its own
  // grammar wants it. The same message the step-up toast carries.
  const modeName = t(labelOf(mode))
  // Which way the card was answered, read once the exit animation has played. Both ways
  // out close the card first: accepting mounts a screen behind it, and unmounting the
  // card at the moment of the press would cut its own exit in half.
  const accepted = useRef(false)

  return (
    <ModalCard
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
          {/* Sentence case, the toast's voice: the caps in this app are for labels and
              buttons, and the offer is meant to be read rather than obeyed. */}
          <Text
            selectable={false}
            className={cn(TYPE.button, 'mb-1.5 text-center text-primary')}
          >
            <Trans>That is every move learned.</Trans>
          </Text>
          <Text
            selectable={false}
            className={cn(TYPE.prose, 'mb-5 text-center text-dim')}
          >
            <Trans>Ready to play for real?</Trans>
          </Text>

          <TrackedPressable
            id="tutorial_done.accept"
            onPress={() => {
              accepted.current = true
              close()
            }}
            className="w-full overflow-hidden rounded-xl"
          >
            <LinearGradient
              colors={[...darkGradientOf(mode)]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="items-center py-3.5"
            >
              <Text
                selectable={false}
                numberOfLines={1}
                className="font-mono text-[12px] font-black tracking-[2px] text-on-strong"
              >
                <Trans>TRY {modeName}</Trans>
              </Text>
            </LinearGradient>
          </TrackedPressable>

          {/* The small-label voice, a size below the offer it turns down — the same way
              out the toast carries, in the same words. */}
          <TrackedPressable
            id="tutorial_done.dismiss"
            onPress={close}
            className="mt-1 items-center py-2"
          >
            <Text selectable={false} className={cn(TYPE.label, 'text-dim underline')}>
              <Trans>NOT NOW</Trans>
            </Text>
          </TrackedPressable>
        </View>
      )}
    </ModalCard>
  )
}
