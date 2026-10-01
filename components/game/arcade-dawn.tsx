import { Trans } from '@lingui/react/macro'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { DAWN_MS, DAWN_OUT_MS } from '@/constants/arcade'

// The words an arcade run opens on, over the part of the screen the map will fill.
//
// The dial is already there underneath — dimmed, because there is nothing to answer yet —
// so the run does not arrive as a dealt board with a clock on it. It arrives as a sentence,
// and the map draws itself in as the sentence leaves. That handover is the whole point of
// the card: a player's first frame of arcade is a place being set out rather than a
// countdown already running.
//
// It covers the canvas rather than the viewport, and it is opaque: nothing is drawn behind
// it, so there is nothing to see through to. The beat it is up for is `dawn` — see
// hooks/use-arcade-run.ts, where the fan is held back until this has had its say.

// The words, then the rule under them, then the question. Staggered so the card builds
// rather than arriving in one piece, and slow enough to be read at a glance rather than
// caught — this is the one beat of a run with nothing to answer, so it is the one beat that
// can afford to take its time.
const LEAD_MS = 220
const IN_MS = 620
const RULE_MS = 760
const TAIL_MS = 420

// How far the words rise into place, and how far they go on drifting for the rest of the
// beat. The rise is settling rather than an entrance; the drift is what keeps the card from
// standing still through a hold this long — slow enough that it is felt and not watched.
const RISE = 10
const DRIFT = 4

// What is left of the beat once the words have landed, which is what the drift is spread
// over. Taken from the beat itself, so retuning DAWN_MS cannot leave the card finishing its
// movement after the map has arrived.
const SETTLED_MS = LEAD_MS + IN_MS + 120
const DRIFT_MS = Math.max(0, DAWN_MS - SETTLED_MS)

export function ArcadeDawn({ ink }: { ink: string }) {
  const words = useSharedValue(0)
  const lift = useSharedValue(RISE)
  const rule = useSharedValue(0)
  const tail = useSharedValue(0)

  useEffect(() => {
    words.value = withDelay(LEAD_MS, withTiming(1, { duration: IN_MS }))
    lift.value = withDelay(
      LEAD_MS,
      withSequence(
        withTiming(0, { duration: IN_MS + 120, easing: Easing.out(Easing.cubic) }),
        withTiming(-DRIFT, { duration: DRIFT_MS, easing: Easing.linear }),
      ),
    )
    rule.value = withDelay(
      LEAD_MS + IN_MS / 2,
      withTiming(1, { duration: RULE_MS, easing: Easing.out(Easing.cubic) }),
    )
    tail.value = withDelay(
      LEAD_MS + IN_MS / 2 + TAIL_MS,
      withTiming(1, { duration: IN_MS }),
    )
  }, [])

  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: lift.value }],
  }))
  // Drawn from the middle out rather than faded in place: a rule being struck is a line
  // under what was just said, and scaling it costs no layout.
  const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: rule.value }] }))
  const tailStyle = useAnimatedStyle(() => ({ opacity: tail.value }))

  return (
    <Animated.View
      pointerEvents="none"
      exiting={FadeOut.duration(DAWN_OUT_MS)}
      className="absolute inset-0 items-center justify-center bg-surface px-10"
    >
      <View className="items-center gap-3">
        <Animated.Text
          selectable={false}
          style={[{ color: ink }, wordsStyle]}
          className="text-center font-mono text-[20px] font-black tracking-[3px]"
        >
          <Trans>LET THE ADVENTURE BEGIN</Trans>
        </Animated.Text>

        <Animated.View style={ruleStyle} className="h-px w-16 bg-muted" />

        <Animated.View style={tailStyle}>
          <Text
            selectable={false}
            // Sentence case, so the tracking goes with it: wide letter-spacing is a caps
            // device in here, and the one line on this card that is a question rather than a
            // statement reads as prose.
            className="text-center font-mono text-[12px] tracking-[0.3px] text-dim"
          >
            <Trans>How far can you go?</Trans>
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  )
}
