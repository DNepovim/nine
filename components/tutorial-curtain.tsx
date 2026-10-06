import { Trans } from '@lingui/react/macro'
import { useEffect, useRef } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { TrackedPressable } from '@/components/tracked-pressable'
import { LAYER } from '@/constants/layers'
import { gradientOf } from '@/modes'

// How long the words hold before they start to go, and how long going takes.
//
// The hold is about as long as the line takes to read twice, which is the length that
// reads as a beat rather than as a screen the player has been left on. The fade is slow
// enough to be a hand-off and not a cut: what is underneath by then is a board with a
// target already springing in, and the point of the whole screen is that the two are seen
// to be the same moment.
const HOLD_MS = 1400
const FADE_MS = 500

// The beat before a lesson.
//
// Every door into the tutorial comes through here — the first launch, TRY IT at the end of
// the guide, and the dev sidebar — so the lesson is never the first thing a player sees of
// itself. The words say what is about to happen and that none of it is scored; the board
// is dealt as they start to go.
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
  //
  // Latched on this side rather than read off the opacity: a write to a shared value is
  // posted to the UI thread and lands there when it lands, so a thumb racing the hold's
  // own timer can read a full curtain twice and deal the run twice with it. A plain ref
  // is set in the same tick it is tested.
  const lifted = useRef(false)
  const lift = () => {
    if (lifted.current) return
    lifted.current = true
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
      <TrackedPressable
        id="tutorial.curtain_lift"
        onPress={lift}
        className="flex-1 items-center justify-center"
      >
        <Text
          selectable={false}
          className="px-8 text-center font-mono text-[15px] font-black tracking-[2px]"
          style={{ color: gradientOf('trainee')[0] }}
        >
          <Trans>LET'S LEARN THE GAME</Trans>
        </Text>
        {/* The second line is the whole reason this screen is worth a beat: a lesson that
          opens straight onto a board looks exactly like a run, and a player who thinks
          they are being scored plays it like one. Dim and under the tint, because it is
          the smaller of the two things being said. */}
        <Text
          selectable={false}
          className="mt-3 px-8 text-center font-mono text-[11px] font-bold leading-[18px] tracking-[1px] text-dim"
        >
          <Trans>JUST THE TUTORIAL - NOTHING HERE IS SCORED</Trans>
        </Text>
      </TrackedPressable>
    </Animated.View>
  )
}
