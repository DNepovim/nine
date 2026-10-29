import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { PieCountdown, TARGET_EXIT_MS } from '@/components/game/pie-countdown'
import { CARD_ENTER_MS } from '@/constants/game'
import { mono } from '@/constants/theme'
import { useDriftedValue } from '@/hooks/use-drifted-value'
import { glimpseLeft } from '@/lib/target-clock'
import type { DisplayTarget } from '@/types/game'

// How far a taken card is held back once it has settled.
//
// Plainly done and still plainly there, which is the whole job: a drilled board is nine
// cards the player is learning as one picture, and the taken ones are what says how far
// through it they are. Too faint and the picture loses a card anyway; too strong and the
// board stops showing which ones are left.
const SPENT_OPACITY = 0.3

export function TargetCard({
  target,
  maxValue,
  duration,
  size,
  color,
  par,
  dying = false,
  frozen = false,
  clocked = true,
  spent = false,
  glimpse = null,
  driftStep = null,
  onExpire,
  onExitComplete,
}: {
  target: DisplayTarget
  // The board's ceiling, for the band tint under the number — see PieCountdown.
  maxValue: number
  duration: number
  // How wide the card is drawn, where that is not the one every mode draws. A
  // **drilled** run sets it: nine cards have to stand on the board at once, and nine at
  // `PIE_SIZE` do not fit a phone. Undefined everywhere else, which is `PieCountdown`'s
  // own default — the pie scales its whole drawing off this, so nothing here has to.
  size?: number
  // The disc this card stands on, where the mode has an opinion. A **drilled** run gives
  // each of its nine a tint of its challenge's own family — a fixed board is learnt as a
  // picture, and a colour is read before a number is. Undefined everywhere else, where
  // the disc is tinted by the target's hundreds instead; see `TARGET_BAND_TRACK`.
  color?: string
  par?: number
  dying?: boolean
  // The run is paused: hold the clock where it is until play resumes.
  frozen?: boolean
  // Whether this target has a clock to run down at all — false in the tutorial, where a
  // target waits as long as it takes and leaves only when it is hit. Not the same thing
  // as `frozen`, which is a clock stopped for a moment; see PieCountdown.
  clocked?: boolean
  // Whether a card taken on this board **stays** on it, marked, instead of leaving.
  //
  // True for a **drilled** run and nothing else. Its nine are a fixed picture, dealt in
  // the same nine places every run, and the player is learning that picture — a card
  // that vanished when it was hit would take a ninth of it away each time, so by the
  // last target there would be nothing left to have learnt.
  //
  // A settled card is out of the run either way: the machine dropped it the moment it
  // was taken, so nothing here can be hit twice. What stays is the drawing.
  spent?: boolean
  // The run's **glimpse**: how long a target's number shows once it arrives, or null for
  // one that never hides. Handed to the pie as whatever of it is still left — a card put
  // back from storage long after its target arrived has had its glimpse, and must not
  // show its number a second time. See `glimpseLeft`.
  glimpse?: number | null
  // The run's **drift** step in ms, or null where numbers hold still. Which way this card
  // drifts is the target's own; see `drift` on `Target`.
  driftStep?: number | null
  onExpire: () => void
  onExitComplete: () => void
}) {
  const scale = useSharedValue(0.6)
  const opacity = useSharedValue(0)

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 200 })
    opacity.value = withTiming(1, { duration: CARD_ENTER_MS })
  }, [])

  useEffect(() => {
    // On game over the target isn't removed from the machine, so it never picks up an
    // exit — drive the freeze-and-shrink straight off the `dying` prop instead.
    if (dying) {
      scale.value = withTiming(0.4, { duration: 500, easing: Easing.in(Easing.quad) })
      opacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })
      return
    }
    if (target.exit === null) return
    // A card that stays fades back rather than out, and never reports itself gone —
    // `onExitComplete` is what takes a target off the board, and this one is not
    // leaving. A card that goes fades all the way and says so.
    //
    // Either way it only fades and holds its size: the movement worth watching is
    // inside the pie, and the fade is what carries the par badge out with it.
    if (spent && target.exit === 'hit') {
      opacity.value = withTiming(SPENT_OPACITY, {
        duration: TARGET_EXIT_MS,
        easing: Easing.out(Easing.quad),
      })
      return
    }
    opacity.value = withTiming(
      0,
      { duration: TARGET_EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished) scheduleOnRN(onExitComplete)
      },
    )
  }, [target.exit, dying])

  // On its way out — hit, lost, or swept off by the end of the run. Named once because the
  // pie reads it twice: its clock stops for it, and a glimpsed number comes back for it.
  const leaving = target.exit !== null || dying

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  // The number now, on a **drifting** run; the number it arrived as everywhere else.
  // Held while the run is paused and as the card leaves, so a hit card shows what it was
  // taken at.
  const reading = useDriftedValue(target, driftStep, !leaving && !frozen)
  const shown = target.takenAt ?? reading

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: target.position.x,
          top: target.position.y,
        },
        animStyle,
      ]}
    >
      <PieCountdown
        maxValue={maxValue}
        size={size}
        backgroundColor={color}
        settles={spent}
        glimpse={glimpseLeft(glimpse, target.startProgress, target.duration)}
        revealed={leaving}
        value={shown}
        active={!leaving && !frozen}
        clocked={clocked}
        duration={duration}
        startProgress={target.startProgress}
        exit={target.exit}
        onComplete={onExpire}
      />
      {par !== undefined && (
        <View
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            backgroundColor: '#6B7280',
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 3,
          }}
        >
          <Text
            selectable={false}
            style={{
              fontFamily: mono,
              fontSize: 13,
              fontWeight: '700',
              color: '#FFFFFF',
            }}
          >
            {par}
          </Text>
        </View>
      )}
    </Animated.View>
  )
}
