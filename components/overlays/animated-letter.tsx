import { useEffect, useRef } from 'react'
import { View, type StyleProp, type TextStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { ON_GOLD_TEXT_SHADOW } from '@/constants/theme'
import {
  GLASS_FAR_ALPHA,
  GLASS_FAR_PX,
  GLASS_FAR_SHADE,
  GLASS_OVERSHOOT_PX,
  GLASS_RIM_ALPHA,
  GLASS_RIM_LIFT,
  GLASS_RIM_PX,
  GLASS_SHADOW,
  GLASS_SHEEN_ALPHA,
  GLASS_SHEEN_STEPS,
  GLASS_SHEEN_UNTIL,
  GLASS_TINT,
} from '@/lib/glass'
import { type Mode } from '@/machines/game'

// A letter's colour source: a singleplayer mode, the arcade teaser, or the
// multiplayer identity — the intro title switches between the last two depending on
// which of ALONE / WITH FRIENDS is open.
type TitleMode = Mode | 'arcade' | 'multiplayer'

// Vibrant off-spectrum intermediates — chosen to be as far from the
// app's blue-purple-red-amber palette as possible so each mode switch
// sweeps visibly through foreign hue territory.
const MID_COLORS: Record<string, string> = {
  'trainee->accuracy': '#00D4FF', // cyan
  'trainee->speed': '#AAFF00', // lime
  'trainee->arcade': '#FFE000', // vivid yellow — warm, far from blue
  'accuracy->trainee': '#FF00CC', // hot-pink
  'accuracy->speed': '#FF7700', // orange
  'accuracy->arcade': '#00BFFF', // sky blue — cool contrast to red-amber
  'speed->trainee': '#00FFCC', // mint
  'speed->accuracy': '#DD00FF', // violet
  'speed->arcade': '#8800FF', // electric violet — max contrast to warm
  'arcade->trainee': '#00FF7F', // spring green — cool from warm end
  'arcade->accuracy': '#FF3399', // hot pink — saturated bridge to purple
  'arcade->speed': '#00FFCC', // turquoise — cool contrast to red-orange
}

function getMidColor(from: TitleMode, to: TitleMode): string {
  return MID_COLORS[`${from}->${to}`] ?? '#FFFFFF'
}

function rgbaWl(hex: string, alpha: number): string {
  'worklet'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

// The glyph, and the box it is drawn in.
//
// `LINE_HEIGHT` is pinned rather than left to the font because the pane's two edges are
// placed down this box in pixels: a line box that differed between web and native would
// put the lit rim across the top of a letter on one and across its middle on the other.
const FONT_SIZE = 56
const LINE_HEIGHT = 64

// Where the capitals sit inside that box. Every title this draws is upper-case and
// monospace, so one measurement answers for all of them — and it is the cap box the light
// has to break across, since the rest of the line box is air. Both edges overshoot it, so
// a font whose capitals sit a pixel or two off where this expects is still lit: a band is
// a window onto the glyph, and a window past the end of it shows nothing.
const CAP_TOP = 12
const CAP_HEIGHT = 39
const CAP_FOOT = CAP_TOP + CAP_HEIGHT

const RIM_TOP = CAP_TOP - GLASS_OVERSHOOT_PX
const RIM_HEIGHT = GLASS_RIM_PX + GLASS_OVERSHOOT_PX
const FAR_TOP = CAP_FOOT - GLASS_FAR_PX
const FAR_HEIGHT = GLASS_FAR_PX + GLASS_OVERSHOOT_PX
const SHEEN_HEIGHT = CAP_TOP + CAP_HEIGHT * GLASS_SHEEN_UNTIL

// The pane's own surface catching the light, falling off in steps — see
// `GLASS_SHEEN_STEPS` for why a glyph's sheen cannot simply be a gradient. White rather
// than the letter's colour, since a reflection is the light's colour and not the thing's,
// which is also why these never change and are plain styles rather than animated ones.
//
// The first step starts at the top of the line box rather than at the cap, so a letter
// whose capitals sit higher than expected is still covered; the slices do not overlap, so
// no alpha stacks on another.
const SHEEN_STEPS = Array.from({ length: GLASS_SHEEN_STEPS }, (_, step) => ({
  top: (SHEEN_HEIGHT * step) / GLASS_SHEEN_STEPS,
  height: SHEEN_HEIGHT / GLASS_SHEEN_STEPS,
  style: {
    color: `rgba(255, 255, 255, ${
      (GLASS_SHEEN_ALPHA * (GLASS_SHEEN_STEPS - step)) / GLASS_SHEEN_STEPS
    })`,
  },
}))

// One band of the letter, clipped out of a copy of it.
//
// The glyph is drawn again in full inside a window that shows only the slice wanted,
// which is the one way to give part of a letter its own colour and keep the letter's own
// shape — no masking, no second font, nothing to keep in step with the glyph but the
// offset it is pushed up by.
function Band({
  char,
  top,
  height,
  style,
}: {
  char: string
  top: number
  height: number
  style: StyleProp<TextStyle>
}) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top, height, overflow: 'hidden' }}
    >
      <Animated.Text
        selectable={false}
        className="font-mono font-black"
        style={[style, { fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, marginTop: -top }]}
      >
        {char}
      </Animated.Text>
    </View>
  )
}

// One letter of a big title, drawn as a pane of glass.
//
// Four copies of the same glyph, stacked: the pane itself with the surface coming through
// it, the sheen across its top, the far edge along its foot and the lit rim along its top.
// Every tone is the letter's own colour with the alpha and the value moved — see
// `lib/glass.ts` — so the mode gradient, its cycling and the sweep through a foreign hue
// on a mode switch all drive the whole stack at once and the hue never moves.
//
// The float lives on the wrapper rather than on any one copy: four layers bobbing to
// their own clocks would come apart.
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
  shadow = false,
}: {
  char: string
  color: string
  tBase: number
  mode: TitleMode
  delay: number
  letterIndex: number
  gradStart: SharedValue<string>
  gradEnd: SharedValue<string>
  gradPhase: SharedValue<number>
  // Set on the gold game-over screen, where a celebration plays behind the letters.
  shadow?: boolean
}) {
  const prevColorRef = useRef(color)
  const prevModeRef = useRef<TitleMode>(mode)
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

  // The letter's own colour, worked out once a frame. The three tones below are that
  // colour with its alpha and value moved, so the whole pane costs one colour rather
  // than three.
  const colour = useDerivedValue(() => {
    const p = progress.value
    if (p >= 1) {
      // Idle: each letter tracks its phase-offset position in the moving gradient.
      const t = (((tBase + gradPhase.value) % 1) + 1) % 1
      return lerpHexWl(gradStart.value, gradEnd.value, t)
    }
    // Mode switch: two-segment lerp from→mid over first half, mid→to over second half.
    return p <= 0.5
      ? lerpHexWl(from.value, mid.value, p * 2)
      : lerpHexWl(mid.value, to.value, (p - 0.5) * 2)
  })

  const paneStyle = useAnimatedStyle(() => ({
    color: rgbaWl(colour.value, GLASS_TINT),
  }))
  const rimStyle = useAnimatedStyle(() => ({
    color: rgbaWl(lerpHexWl(colour.value, '#ffffff', GLASS_RIM_LIFT), GLASS_RIM_ALPHA),
  }))
  const farStyle = useAnimatedStyle(() => ({
    color: rgbaWl(lerpHexWl(colour.value, '#000000', GLASS_FAR_SHADE), GLASS_FAR_ALPHA),
  }))

  const glyph = { fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT } as const

  return (
    <View className={`letter-float-${letterIndex}`}>
      {/* The pane — the only copy in flow, so the letter measures exactly as it did
          before any of this. It carries the shadow the pane floats on, and on the gold
          screen the celebration's halo takes that slot instead: one text can cast one
          shadow, and on that screen the halo is the one that has to be there. */}
      <Animated.Text
        selectable={false}
        className="font-mono font-black"
        style={[paneStyle, glyph, shadow ? ON_GOLD_TEXT_SHADOW : GLASS_SHADOW]}
      >
        {char}
      </Animated.Text>

      {SHEEN_STEPS.map((step) => (
        <Band
          key={step.top}
          char={char}
          top={step.top}
          height={step.height}
          style={step.style}
        />
      ))}
      <Band char={char} top={FAR_TOP} height={FAR_HEIGHT} style={farStyle} />
      <Band char={char} top={RIM_TOP} height={RIM_HEIGHT} style={rimStyle} />
    </View>
  )
}
