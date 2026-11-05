import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { useViewport } from '@/hooks/use-viewport'

// `waiting` is a run that has ended but whose screen is not done: the cinematic is held while
// something behind the run plays out, as NO SLIP's last beat crossing its monitor.
export type DyingPhase = 'idle' | 'waiting' | 'dying' | 'blend' | 'done'

// How long the floating title sits over the frozen targets before it flies, and how long
// the flight itself takes. The hand-off happens the moment it lands, so these two also
// say when the game-over screen becomes the player's.
const HOLD_MS = 1500
const FLIGHT_MS = 450

// Drives the last-life death sequence and the per-life-loss red flash.
//
// On life loss the screen flashes red. On the final life it holds red and runs:
// freeze targets → a floating "GAME OVER" title pops in over them → after a hold
// the title flies up to the game-over overlay's title slot while that overlay
// crossfades in behind it → hand off to the overlay's own title.
//
// `hold` is how long, in ms, the run's remains still have to play out when the run ends, or
// null for a run whose remains have nothing to wait for. The cinematic — the red flash too —
// starts when it has run out, and until then the screen is the run's own, still.
export function useDyingSequence({
  isGameOver,
  lives,
  hold,
}: {
  isGameOver: boolean
  lives: number
  hold: (() => number) | null
}) {
  const { height: windowHeight } = useViewport()
  // Read by the sequence rather than depended on by it. The flight path is measured
  // from the viewport, but the viewport is not what starts the cinematic: a height that
  // moves while the game-over screen is up — coming back from another app, a rotation,
  // a browser window resized — would otherwise re-run the effect below, drop the
  // finished overlay back to `dying` and play the whole two seconds again over a screen
  // the player had already read.
  const windowHeightRef = useRef(windowHeight)
  windowHeightRef.current = windowHeight

  const flashOp = useSharedValue(0)
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }))

  const titleOpacity = useSharedValue(0)
  const titleScale = useSharedValue(0)
  const titleTranslateY = useSharedValue(0)
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }, { scale: titleScale.value }],
  }))
  const overlayOpacity = useSharedValue(0)
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }))

  const [phase, setPhase] = useState<DyingPhase>('idle')
  // Whether the cinematic has begun for this run's end. Until it has, a held run is `waiting`.
  const [begun, setBegun] = useState(false)
  const targetsAreaRef = useRef<View>(null)
  const overlayTitleYRef = useRef<number | null>(null)

  const prevLivesRef = useRef(lives)
  useEffect(() => {
    // Trainee's lives are Infinity, and stepping up from a Trainee run into a
    // scored one resets `lives` to that mode's finite count in the same instant —
    // a genuine decrease by the numbers, but not a life lost. Comparing only while
    // both sides are finite keeps that transition silent.
    let flashTimer: ReturnType<typeof setTimeout> | null = null
    if (Number.isFinite(prevLivesRef.current) && lives < prevLivesRef.current) {
      // Final life holds the red for the dying sequence; others flash and fade.
      if (lives <= 0) {
        flashTimer = setTimeout(() => {
          flashOp.value = withSequence(
            withTiming(0.4, { duration: 80 }),
            withTiming(0.2, { duration: 300 }),
          )
        }, hold?.() ?? 0)
      } else {
        flashOp.value = withSequence(
          withTiming(0.3, { duration: 80 }),
          withTiming(0, { duration: 380 }),
        )
      }
    }
    prevLivesRef.current = lives
    return () => {
      if (flashTimer !== null) clearTimeout(flashTimer)
    }
  }, [lives, flashOp])

  useEffect(() => {
    if (!isGameOver) {
      setPhase('idle')
      setBegun(false)
      titleOpacity.value = 0
      titleScale.value = 0
      overlayOpacity.value = 0
      return
    }

    let blendTimer: ReturnType<typeof setTimeout> | null = null
    let doneTimer: ReturnType<typeof setTimeout> | null = null
    const begin = () => {
      setBegun(true)
      // One height for the whole flight: the pop-in, the path and the fallback landing
      // all measure from the screen as it stood when the run ended.
      const screenHeight = windowHeightRef.current
      const screenCenterY = screenHeight / 2
      setPhase('dying')
      overlayOpacity.value = 0
      titleOpacity.value = 0
      titleScale.value = 0

      // Place the floating title at the centre of the (frozen) targets area.
      targetsAreaRef.current?.measureInWindow((_x, y, _w, h) => {
        titleTranslateY.value = y + h / 2 - screenCenterY
      })

      // Pop in after the targets have shrunk away (500ms).
      titleOpacity.value = withDelay(500, withTiming(1, { duration: 300 }))
      titleScale.value = withDelay(500, withSpring(1, { damping: 14, stiffness: 120 }))

      // After the hold, fly the title up to the overlay title slot and fade the
      // game-over overlay in behind it.
      blendTimer = setTimeout(() => {
        setPhase('blend')
        const endY = overlayTitleYRef.current ?? screenHeight * 0.22
        overlayOpacity.value = withTiming(1, { duration: FLIGHT_MS })
        titleTranslateY.value = withTiming(endY - screenCenterY, {
          duration: FLIGHT_MS,
          easing: Easing.inOut(Easing.quad),
        })
        // The flying copy stays at full opacity all the way up: it is handed off by being
        // swapped for the overlay's own copy of the same letters, not by being faded out.
        // Fading it mid-flight left a gap with nothing in the slot, and the overlay's title
        // — which only unhides at `done` — then arrived as a flash.
        flashOp.value = withTiming(0, { duration: FLIGHT_MS })
      }, HOLD_MS)

      // Hand off the instant the flight lands, so the swap is one commit: the flying copy
      // unmounts and the overlay's identical title unhides in the same frame.
      doneTimer = setTimeout(() => {
        setPhase('done')
      }, HOLD_MS + FLIGHT_MS)
    }

    // The remains' wait is asked now, in the effect: what the run's last press sent across
    // the screen was sent in this same commit, by a child's effect that has already run.
    const waitTimer = setTimeout(begin, hold?.() ?? 0)

    return () => {
      clearTimeout(waitTimer)
      if (blendTimer !== null) clearTimeout(blendTimer)
      if (doneTimer !== null) clearTimeout(doneTimer)
    }
  }, [isGameOver, flashOp, titleOpacity, titleScale, titleTranslateY, overlayOpacity])

  const setOverlayTitleY = (centerY: number) => {
    overlayTitleYRef.current = centerY
  }

  // Held for the remains: the run is over and the cinematic has not begun.
  const waiting = isGameOver && hold !== null && !begun

  return {
    phase: waiting ? ('waiting' as const) : phase,
    flashStyle,
    titleStyle,
    overlayStyle,
    overlayOpacity,
    targetsAreaRef,
    setOverlayTitleY,
  }
}
