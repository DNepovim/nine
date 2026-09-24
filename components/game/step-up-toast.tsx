import { Trans, useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'
import Animated, { Easing, FadeOut, SlideInUp } from 'react-native-reanimated'

import { DARK_MODE_GRADIENT, MODES, type Mode } from '@/machines/game'

// Where it floats. Above the top bar rather than inside the layout: Trainee reclaims the
// best-scores band it would otherwise sit in, so anything in the flow here would push the
// whole board down the moment it appeared.
const TOP = 8

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// The mark over the words, the way the record screens wear an emblem over their title.
// A flame for the thing that opened this: a run of clean hits with no miss in it. It
// speaks for the streak rather than for the mode being offered — the button below is
// already wearing Accuracy's colour, and two things pointing at the destination would
// leave nothing pointing at what the player just did.
const MARK = '🔥'

// Trainee's invitation to a scored board, floating over the top bars mid-run.
//
// It carries the destination's colour, not Trainee's: the button is a door to Accuracy,
// and wearing the mode it leads to is what the mode selector already does.
//
// NOT NOW is not decoration. This one waits for an answer instead of withdrawing on its
// own, and where it floats is the top bar — NINE and the way out of the run are behind
// it. A question that holds has to be answerable both ways.
export function StepUpToast({
  opener,
  invite,
  mode,
  onPress,
  onDismiss,
}: {
  opener: string
  invite: string
  // The mode being offered, so the button can name it. Which difficulty it starts on is
  // the next screen's to say — here it would be a third thing to read in a toast whose
  // whole job is to be glanced at.
  mode: Mode
  onPress: () => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  // Named rather than inlined, so the translated line can put the mode wherever
  // its own grammar wants it.
  const modeName = t(MODES[mode].label)
  return (
    <Animated.View
      entering={SlideInUp.duration(320).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(240)}
      className="absolute left-0 right-0 z-50 items-center px-4"
      style={{ top: TOP }}
    >
      <View className="w-full max-w-3xs rounded-2xl bg-card p-4" style={shadow}>
        {/* Sentence case, the announcement bar's voice: the caps in this app are for
            labels and buttons, and two shouting lines would read as an alarm. */}
        <Text selectable={false} className="mb-1 text-center text-[20px] leading-[24px]">
          {MARK}
        </Text>
        {/* Set apart from the invitation below rather than run against it: they are two
            thoughts, not a wrapped sentence, and touching lines read as one. */}
        <Text
          selectable={false}
          className="mb-1.5 text-center font-mono text-[12px] font-bold text-primary"
        >
          {opener}
        </Text>
        <Text
          selectable={false}
          className="mb-3 text-center font-mono text-[12px] text-dim"
        >
          {invite}
        </Text>

        <Pressable onPress={onPress} className="overflow-hidden rounded-xl">
          <LinearGradient
            colors={[...DARK_MODE_GRADIENT[mode]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="items-center py-3"
          >
            <Text
              selectable={false}
              numberOfLines={1}
              className="font-mono text-[12px] font-black tracking-[2px] text-on-strong"
            >
              <Trans>TRY {modeName}</Trans>
            </Text>
          </LinearGradient>
        </Pressable>

        {/* The small-label voice, a size below the invitation it turns down, so the
            offer is still the thing being read. */}
        <Pressable onPress={onDismiss} className="mt-1 items-center py-2">
          <Text
            selectable={false}
            className="font-mono text-[10px] font-bold tracking-[1px] text-dim underline"
          >
            <Trans>NOT NOW</Trans>
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}
