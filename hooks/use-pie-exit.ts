import { useEffect } from 'react'
import {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { PIE_INK } from '@/constants/colors'
import { TARGET_EXIT_MS } from '@/constants/game'
import type { TargetExit } from '@/types/game'

// The hit: the ring collapses under the number while the number swells out of it.
const HIT_RING_SCALE = 0.35
const HIT_NUMBER_SCALE = 1.7

// The loss: the colours go first — one quick beat in which the whole pie turns red and
// the numeral turns white — and only then is the number pressed flat into it.
const FAIL_COLOR_MS = 100
const FAIL_SQUASH = 0.06

// How a pie leaves, hit or lost: the values both exits drive, the one effect that drives
// them, and the styles that draw them. The numeral's own transform is the pie's — it is
// shared with the glimpse — so its two scales come back rather than a style.
export function usePieExit({
  exit,
  settles,
  hitInk,
  lostNumeral,
  orbInk,
}: {
  exit: TargetExit | null
  settles: boolean
  // The scheme's ink for a number taken, or null where a hit keeps the disc's own.
  hitInk: string | null
  lostNumeral: string
  // An orb's numeral ink, where the disc is one.
  orbInk: string | undefined
}) {
  const ringScale = useSharedValue(1)
  const ringOpacity = useSharedValue(1)
  const numberScale = useSharedValue(1)
  const numberSquash = useSharedValue(1)
  // 0 = the clock's own colours, 1 = the red disc a lost target turns into.
  const failColor = useSharedValue(0)
  // 0 = the disc's ink, 1 = the scheme's `hit` ink, for a number taken.
  const hitColor = useSharedValue(0)

  // The two exits are the same length and opposite in every other way. A hit lets the
  // number out of the ring that was timing it; a loss buries it in one — the clock's
  // colours go, the disc turns red, and the number is pressed flat into it.
  useEffect(() => {
    if (exit === null) return
    if (exit === 'hit') {
      if (hitInk !== null) {
        hitColor.value = withTiming(1, {
          duration: TARGET_EXIT_MS / 2,
          easing: Easing.out(Easing.quad),
        })
      }
      // A card that settles keeps its disc: collapsing it would throw away the one
      // thing a drilled board is read by. A card that leaves collapses as it always
      // has — the ring going in is what makes the number come out.
      if (!settles) {
        ringScale.value = withTiming(HIT_RING_SCALE, {
          duration: TARGET_EXIT_MS,
          easing: Easing.in(Easing.quad),
        })
      }
      numberScale.value = settles
        ? // Out and back, in the same time the leaving card takes to go — so a hit
          // reads as the same beat whether the card stays or not. Held at 1.7 it would
          // be a numeral standing over its neighbours for the rest of the run.
          withSequence(
            withTiming(HIT_NUMBER_SCALE, {
              duration: TARGET_EXIT_MS / 2,
              easing: Easing.out(Easing.quad),
            }),
            withTiming(1, {
              duration: TARGET_EXIT_MS / 2,
              easing: Easing.inOut(Easing.quad),
            }),
          )
        : withTiming(HIT_NUMBER_SCALE, {
            duration: TARGET_EXIT_MS,
            easing: Easing.out(Easing.quad),
          })
      return
    }
    failColor.value = withTiming(1, {
      duration: FAIL_COLOR_MS,
      easing: Easing.out(Easing.quad),
    })
    ringOpacity.value = withTiming(0, {
      duration: TARGET_EXIT_MS,
      easing: Easing.in(Easing.quad),
    })
    numberSquash.value = withTiming(FAIL_SQUASH, {
      duration: TARGET_EXIT_MS,
      easing: Easing.in(Easing.quad),
    })
  }, [exit])

  // The red comes over the pie rather than through it: one disc the exact size of the
  // ring, fading in across the track and both arcs at once, so what is left is a plain
  // red circle however much clock the target had on it.
  const failDiscStyle = useAnimatedStyle(() => ({
    opacity: failColor.value,
  }))

  // Only taken over once the target is lost — until then the `pie` token paints the
  // numeral, so a screen that retints the token still gets its way.
  const numberColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(failColor.value, [0, 1], [PIE_INK, lostNumeral]),
  }))

  const numberHitStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      hitColor.value,
      [0, 1],
      [orbInk ?? PIE_INK, hitInk ?? PIE_INK],
    ),
  }))

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }))

  return {
    numberScale,
    numberSquash,
    failDiscStyle,
    numberColorStyle,
    numberHitStyle,
    ringStyle,
  }
}
