import { Trans } from '@lingui/react/macro'
import { useEffect } from 'react'
import { Pressable, Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { LAYER } from '@/constants/layers'
import { MODE_GRADIENT } from '@/machines/game'

// How long the words hold before they start to go, and how long going takes.
//
// The hold is about as long as the line takes to read twice, which is the length that
// reads as a beat rather than as a screen the player has been left on. The fade is slow
// enough to be a hand-off and not a cut: what is underneath by then is a board with a
// target already springing in, and the point of the whole screen is that the two are seen
// to be the same moment.
const HOLD_MS = 1400
const FADE_MS = 500

// The beat between the splash and the lesson.
//
// It is the app's own surface rather than white, and that is the whole trick: the ground
// under the words is the ground the game is about to be drawn on, so the hand-off is the
// words fading off a board rather than one screen being replaced by another. In light that
// surface is a warm off-white and in dark it is near-black — a literal white would flash on
// a dark launch and then have to fade back down to a dark board.
export function TutorialCurtain({
  // The fade has started. Whatever should be underneath when it finishes has this long to
  // get ready — the same contract the splash's own exit offers, and for the same reason:
  // a run dealt at the end of a fade is a run the player watches arrive into an empty
  // screen.
  onLift,
  // The curtain has gone and can be unmounted.
  onGone,
}: {
  onLift: () => void
  onGone: () => void
}) {
  const opacity = useSharedValue(1)

  // One-way, whether the hold ran out or a thumb cut it short.
  const lift = () => {
    if (opacity.value < 1) return
    onLift()
    opacity.value = withTiming(
      0,
      { duration: FADE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet'
        if (finished) scheduleOnRN(onGone)
      },
    )
  }

  useEffect(() => {
    const timer = setTimeout(lift, HOLD_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: LAYER.curtain,
        },
        style,
      ]}
      className="bg-surface"
    >
      {/* The whole screen takes the tap: a player who has read it should not have to find
        anything to press. */}
      <Pressable onPress={lift} className="flex-1 items-center justify-center">
        <Text
          selectable={false}
          className="px-8 text-center font-mono text-[15px] font-black tracking-[2px]"
          style={{ color: MODE_GRADIENT.trainee[0] }}
        >
          <Trans>LET'S LEARN THE GAME</Trans>
        </Text>
      </Pressable>
    </Animated.View>
  )
}
