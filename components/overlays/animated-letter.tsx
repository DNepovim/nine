import { useEffect, useRef } from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { type Mode } from '@/machines/game'

// Vibrant off-spectrum intermediates — chosen to be as far from the
// app's blue-purple-red palette as possible so each mode switch sweeps
// visibly through foreign hue territory.
const MID_COLORS: Record<string, string> = {
  'trainee->accuracy': '#00D4FF', // cyan
  'trainee->speed': '#AAFF00', // lime
  'accuracy->trainee': '#FF00CC', // hot-pink
  'accuracy->speed': '#FF7700', // orange
  'speed->trainee': '#00FFCC', // mint
  'speed->accuracy': '#DD00FF', // violet
}

function getMidColor(from: Mode, to: Mode): string {
  return MID_COLORS[`${from}->${to}`] ?? '#FFFFFF'
}

function lerpHexWl(a: string, b: string, t: number): string {
  'worklet'
  if (t <= 0) return a
  if (t >= 1) return b
  const r1 = parseInt(a.slice(1, 3), 16)
  const g1 = parseInt(a.slice(3, 5), 16)
  const b1 = parseInt(a.slice(5, 7), 16)
  const r2 = parseInt(b.slice(1, 3), 16)
  const g2 = parseInt(b.slice(3, 5), 16)
  const b2 = parseInt(b.slice(5, 7), 16)
  const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${hex2(r1 + (r2 - r1) * t)}${hex2(g1 + (g2 - g1) * t)}${hex2(b1 + (b2 - b1) * t)}`
}

export function AnimatedLetter({
  char,
  color,
  tBase,
  mode,
  delay,
  letterIndex,
  gradStart,
  gradEnd,
  gradPhase,
}: {
  char: string
  color: string
  tBase: number
  mode: Mode
  delay: number
  letterIndex: number
  gradStart: SharedValue<string>
  gradEnd: SharedValue<string>
  gradPhase: SharedValue<number>
}) {
  const prevColorRef = useRef(color)
  const prevModeRef = useRef(mode)
  const canAnimateRef = useRef(false)
  const progress = useSharedValue(1)
  const from = useSharedValue(color)
  const mid = useSharedValue('#FFFFFF')
  const to = useSharedValue(color)

  // Delay animations until persistence has settled so the initial hydration
  // jump (machine default 'accuracy' → saved mode) is invisible.
  useEffect(() => {
    const id = setTimeout(() => {
      canAnimateRef.current = true
    }, 500)
    return () => {
      clearTimeout(id)
    }
  }, [])

  useEffect(() => {
    if (color === prevColorRef.current) return
    const prevColor = prevColorRef.current
    const prevMode = prevModeRef.current
    prevColorRef.current = color
    prevModeRef.current = mode
    if (!canAnimateRef.current) {
      from.value = color
      to.value = color
      progress.value = 1
      return
    }
    from.value = prevColor
    mid.value = getMidColor(prevMode, mode)
    to.value = color
    progress.value = 0
    progress.value = withDelay(delay, withTiming(1, { duration: 500 }))
  }, [color, delay, mode])

  const style = useAnimatedStyle(() => {
    const p = progress.value
    if (p >= 1) {
      // Idle: each letter tracks its phase-offset position in the moving gradient.
      const t = (((tBase + gradPhase.value) % 1) + 1) % 1
      return { color: lerpHexWl(gradStart.value, gradEnd.value, t) }
    }
    // Mode switch: two-segment lerp from→mid over first half, mid→to over second half.
    const clr =
      p <= 0.5
        ? lerpHexWl(from.value, mid.value, p * 2)
        : lerpHexWl(mid.value, to.value, (p - 0.5) * 2)
    return { color: clr }
  })

  return (
    <Animated.Text
      selectable={false}
      className={`font-mono text-[56px] font-black letter-float-${letterIndex}`}
      style={style}
    >
      {char}
    </Animated.Text>
  )
}
