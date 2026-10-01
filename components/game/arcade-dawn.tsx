import { Trans } from '@lingui/react/macro'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { DAWN_OUT_MS } from '@/constants/arcade'

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
// rather than arriving in one piece.
const LEAD_MS = 120
const IN_MS = 420
const RULE_MS = 520
const TAIL_MS = 260

// How far the words rise into place. Small: this is settling, not an entrance.
const RISE = 8

export function ArcadeDawn({ ink }: { ink: string }) {
  const words = useSharedValue(0)
  const lift = useSharedValue(RISE)
  const rule = useSharedValue(0)
  const tail = useSharedValue(0)

  useEffect(() => {
    words.value = withDelay(LEAD_MS, withTiming(1, { duration: IN_MS }))
    lift.value = withDelay(
      LEAD_MS,
      withTiming(0, { duration: IN_MS + 120, easing: Easing.out(Easing.cubic) }),
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
            className="text-center font-mono text-[9px] font-bold tracking-[1.5px] text-dim"
          >
            <Trans>HOW DEEP CAN YOU GO?</Trans>
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  )
}
