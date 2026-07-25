import { useEffect, useRef, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

export type DyingPhase = 'idle' | 'dying' | 'blend' | 'done'

// Drives the last-life death sequence and the per-life-loss red flash.
//
// On life loss the screen flashes red. On the final life it holds red and runs:
// freeze targets → a floating "GAME OVER" title pops in over them → after a hold
// the title flies up to the game-over overlay's title slot while that overlay
// crossfades in behind it → hand off to the overlay's own title.
export function useDyingSequence({
  isGameOver,
  lives,
}: {
  isGameOver: boolean
  lives: number
}) {
  const { height: windowHeight } = useWindowDimensions()

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
  const targetsAreaRef = useRef<View>(null)
  const overlayTitleYRef = useRef<number | null>(null)

  const prevLivesRef = useRef(lives)
  useEffect(() => {
    if (lives < prevLivesRef.current) {
      // Final life holds the red for the dying sequence; others flash and fade.
      flashOp.value =
        lives <= 0
          ? withSequence(
              withTiming(0.4, { duration: 80 }),
              withTiming(0.2, { duration: 300 }),
            )
          : withSequence(
              withTiming(0.3, { duration: 80 }),
              withTiming(0, { duration: 380 }),
            )
    }
    prevLivesRef.current = lives
  }, [lives, flashOp])

  useEffect(() => {
    if (!isGameOver) {
      setPhase('idle')
      titleOpacity.value = 0
      titleScale.value = 0
      overlayOpacity.value = 0
      return
    }

    const screenCenterY = windowHeight / 2
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
    const blendTimer = setTimeout(() => {
      setPhase('blend')
      const endY = overlayTitleYRef.current ?? windowHeight * 0.22
      overlayOpacity.value = withTiming(1, { duration: 450 })
      titleTranslateY.value = withTiming(endY - screenCenterY, {
        duration: 450,
        easing: Easing.inOut(Easing.quad),
      })
      titleOpacity.value = withDelay(250, withTiming(0, { duration: 220 }))
      flashOp.value = withTiming(0, { duration: 450 })
    }, 1500)

    // Hand off to the overlay's own (now-revealed) title.
    const doneTimer = setTimeout(() => {
      setPhase('done')
    }, 2000)

    return () => {
      clearTimeout(blendTimer)
      clearTimeout(doneTimer)
    }
  }, [
    isGameOver,
    windowHeight,
    flashOp,
    titleOpacity,
    titleScale,
    titleTranslateY,
    overlayOpacity,
  ])

  const setOverlayTitleY = (centerY: number) => {
    overlayTitleYRef.current = centerY
  }

  return {
    phase,
    flashStyle,
    titleStyle,
    overlayStyle,
    targetsAreaRef,
    setOverlayTitleY,
  }
}
