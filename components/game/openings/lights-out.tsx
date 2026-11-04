import * as Haptics from 'expo-haptics'
import { useEffect, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Ellipse, Path } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { LIGHTS_OUT } from '@/constants/colors'
import { LAYER } from '@/constants/layers'
import { cordOffset, cordPath } from '@/lib/cord'
import type { OpeningTake } from '@/modes'

// BLACKOUT's **opening**: the lights going out.
//
// A bulb hangs upside down into the top of the game screen on its flex, lit, with a
// pull-cord swaying beside it. The cord is tugged and let go, a wave runs up it, and the bulb
// clicks off — a haptic with the click — and in that
// instant the screen turns over to the dark **scheme**: a black flash covers the switch and
// clears to the dark room, the keys already black. The run begins with the dead bulb still
// hanging there, and it stays for the whole run as the scene's **remains** —
// `LightsOutRemains`, drawn behind the game in grey.
//
// Timed tweens rather than a simulation, at fixed lengths: a cord pull done as physics and
// done slightly wrong reads as fake, where a tug that is merely quick reads as a tug.
//
// The `short` take is for a run dealt again: the bulb is already hanging, so it is only the
// tug and the click — the part that says the lights went out.

// When each beat lands, in ms from the scene's start, per take. `done` leaves the dark
// room a beat to settle after the click before the first target arrives, and `wave` is how
// long the let-go cord takes to settle, which ends before `done` so the hand-over to the
// remains' still cord is not a jump.
const BEATS = {
  full: { drop: 650, tug: 1100, click: 1350, done: 2350, wave: 950 },
  // The tug runs its whole `TUG_MS` before the click, as in the full take, so the cord
  // reaches the bottom of its pull rather than being snapped back mid-way.
  short: { drop: 0, tug: 0, click: 250, done: 650, wave: 380 },
} as const satisfies Record<
  OpeningTake,
  { drop: number; tug: number; click: number; done: number; wave: number }
>

// How far the bulb hangs below the top of the screen, and the flash's clearing time.
const HANG = 150
const VEIL_CLEAR_MS = 480
const TUG_MS = 250
const RETURN_MS = 200
// How far a tug draws the cord down.
const TUG_REACH = 26

const BULB_WIDTH = 96
const BULB_HEIGHT = 94

// How far the cord hangs below the top of the flex, bead not included: a little past the
// tip of the bulb, so the bead is the lowest thing there.
const CORD = HANG + BULB_HEIGHT + 6
const BEAD_RX = 5
const BEAD_RY = 7
// One swing of the cord, there and back.
const SWAY_MS = 3200
// Wide enough for the cord's furthest swing and wave, with the cord down its middle.
const CORD_WIDTH = 32
const CORD_CENTER = CORD_WIDTH / 2
// Puts the cord's middle ten points clear of the bulb's box.
const CORD_GAP = 10 - CORD_CENTER

// The player's pull: how far a finger travels before the cord follows, how far before the
// switch clicks, how far to either side of the cord still counts, and how far down the strip
// starts.
const PULL_STARTS = 8
const PULL_CLICK = 20
const PULL_SLOP = 16
const PULL_TOP = 90

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

// The glass on a 24-unit square, as the mark draws it, scaled up to the bulb's box.
const GLASS =
  'M12 2.2 C7.7 2.2 5 5.4 5 9.2 C5 11.8 6.3 13.4 7.7 14.8 C8.6 15.7 9 16.5 9 17.6 ' +
  'H15 C15 16.5 15.4 15.7 16.3 14.8 C17.7 13.4 19 11.8 19 9.2 C19 5.4 16.3 2.2 12 2.2 Z'
const FILAMENT = 'M10 17.4 V13.4 L11 11.8 L12 13.4 L13 11.8 L14 13.4 V17.4'

// The bulb, drawn lit or dead. Module-level, so the scene's re-renders never remount it.
//
// Turned over, socket up, since it hangs from its flex. The view box stops at the socket so
// the flex meets it rather than a gap above it.
function Bulb({ lit }: { lit: boolean }) {
  return (
    <View style={{ transform: [{ rotate: '180deg' }] }}>
      <Svg width={BULB_WIDTH} height={BULB_HEIGHT} viewBox="0 -1 24 23.5">
        {lit && <Circle cx={12} cy={10} r={11} fill={LIGHTS_OUT.glow} />}
        <Path
          d={GLASS}
          fill={lit ? LIGHTS_OUT.glass : LIGHTS_OUT.deadGlass}
          stroke={LIGHTS_OUT.line}
          strokeWidth={0.9}
        />
        <Path
          d={FILAMENT}
          fill="none"
          stroke={lit ? LIGHTS_OUT.filament : LIGHTS_OUT.line}
          strokeWidth={0.7}
          strokeLinejoin="round"
          strokeOpacity={lit ? 1 : 0.5}
        />
        <Path
          d="M9.2 19.6 H14.8 M10 21.8 H14"
          stroke={LIGHTS_OUT.line}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}

// The lit bulb over the dead one, crossfaded by `lit`, so the click is one frame of
// opacity rather than a re-render racing the haptic.
function SwitchedBulb({ lit }: { lit: SharedValue<number> }) {
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }))
  return (
    <View style={{ width: BULB_WIDTH, height: BULB_HEIGHT }}>
      <View className="absolute inset-0">
        <Bulb lit={false} />
      </View>
      <Animated.View className="absolute inset-0" style={litStyle}>
        <Bulb lit />
      </Animated.View>
    </View>
  )
}

// The pull-cord and the bead a finger would close on, always swaying a little. A `tug`
// stretches it down from its fixing, and `wave` is the ripple of it being let go: nought when
// released, one when spent.
//
// The swing is taken from the wall clock rather than from the moment this mounted, so it
// carries on unbroken when the scene hands over to the remains and a new cord is drawn.
function Cord({ tug, wave }: { tug: SharedValue<number>; wave: SharedValue<number> }) {
  const [phase] = useState(() => (Date.now() % SWAY_MS) / SWAY_MS)
  const clock = useSharedValue(0)
  useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: SWAY_MS, easing: Easing.linear }),
      -1,
      false,
    )
  }, [])
  const sway = useDerivedValue(() => Math.sin(2 * Math.PI * (phase + clock.value)))
  const length = useDerivedValue(() => CORD + tug.value * TUG_REACH)
  const lineProps = useAnimatedProps(() => ({
    d: cordPath(CORD_CENTER, length.value, sway.value, wave.value),
  }))
  const beadProps = useAnimatedProps(() => ({
    cx: CORD_CENTER + cordOffset(1, sway.value, wave.value),
    cy: length.value + BEAD_RY,
  }))
  return (
    <Svg width={CORD_WIDTH} height={CORD + TUG_REACH + 2 * BEAD_RY}>
      <AnimatedPath
        animatedProps={lineProps}
        fill="none"
        stroke={LIGHTS_OUT.line}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <AnimatedEllipse
        animatedProps={beadProps}
        rx={BEAD_RX}
        ry={BEAD_RY}
        fill={LIGHTS_OUT.line}
      />
    </Svg>
  )
}

// The flex with the bulb on it, and the cord beside it — laid out once, so the scene and
// its remains hang the bulb in exactly the same place and the hand-over between them is
// not a jump.
function Hanging({ bulb, cord }: { bulb: ReactNode; cord: ReactNode }) {
  return (
    <View className="flex-row items-start">
      <View className="items-center">
        <View style={{ width: 2, height: HANG, backgroundColor: LIGHTS_OUT.line }} />
        {bulb}
      </View>
      <View style={{ marginLeft: CORD_GAP }}>{cord}</View>
    </View>
  )
}

// How the remains are moved, by `LightsOutPull` above the run. See `pull` on `useOpening`.
type CordPull = { tug: SharedValue<number>; wave: SharedValue<number> }

// What the scene leaves behind: the dead bulb, hanging grey over the run for as long as it
// lasts — the room the player is playing in is the one whose light they just watched go
// out. Drawn behind the targets and the dial, and never pressable. Lit for a **peek**.
export function LightsOutRemains({ lit, pull }: { lit: boolean; pull: CordPull }) {
  return (
    <View
      className="absolute left-0 right-0 top-0 items-center"
      pointerEvents="none"
      aria-hidden
    >
      <Hanging
        bulb={<Bulb lit={lit} />}
        cord={<Cord tug={pull.tug} wave={pull.wave} />}
      />
    </View>
  )
}

// The cord as something to pull, during the run: a swipe down its length draws it after the
// finger, and past `PULL_CLICK` the switch clicks and the lights come on for a **peek**. Let
// go, it springs back with the wave a pull leaves in it.
//
// A strip of its own above the run, since the remains are drawn behind everything and could
// not hear a finger there. It starts below the top rows so they keep their own presses.
export function LightsOutPull({ pull, onPeek }: { pull: CordPull; onPeek: () => void }) {
  const clicked = useSharedValue(false)
  const click = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    onPeek()
  }
  const gesture = Gesture.Pan()
    .activeOffsetY(PULL_STARTS)
    .failOffsetY(-PULL_STARTS)
    .hitSlop({ horizontal: PULL_SLOP })
    .onUpdate((e) => {
      'worklet'
      pull.tug.value = Math.min(1, Math.max(0, e.translationY / TUG_REACH))
      if (clicked.value || e.translationY < PULL_CLICK) return
      clicked.value = true
      scheduleOnRN(click)
    })
    .onFinalize(() => {
      'worklet'
      pull.tug.value = withTiming(0, {
        duration: RETURN_MS,
        easing: Easing.out(Easing.quad),
      })
      if (!clicked.value) return
      clicked.value = false
      pull.wave.value = 0
      pull.wave.value = withTiming(1, {
        duration: BEATS.full.wave,
        easing: Easing.linear,
      })
    })
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          position: 'absolute',
          // Where `Hanging` puts the cord: its row is centred, bulb first.
          left: '50%',
          marginLeft: BULB_WIDTH + CORD_GAP - (BULB_WIDTH + CORD_GAP + CORD_WIDTH) / 2,
          top: PULL_TOP,
          width: CORD_WIDTH,
          height: CORD + 2 * BEAD_RY - PULL_TOP,
          zIndex: LAYER.screen,
        }}
      />
    </GestureDetector>
  )
}

export function LightsOut({ take, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]
  // 0 is hanging in place; 1 is above the top of the screen, where the full take starts.
  const raised = useSharedValue(take === 'full' ? 1 : 0)
  const tug = useSharedValue(0)
  const wave = useSharedValue(1)
  const lit = useSharedValue(1)
  const veil = useSharedValue(0)

  useEffect(() => {
    raised.value = withTiming(0, {
      duration: beats.drop,
      easing: Easing.out(Easing.back(1.4)),
    })
    const timers = [
      setTimeout(() => {
        tug.value = withTiming(1, { duration: TUG_MS, easing: Easing.in(Easing.quad) })
      }, beats.tug),
      setTimeout(() => {
        // The click: the light, the screen and the hand all at once.
        lit.value = 0
        veil.value = 1
        veil.value = withTiming(0, {
          duration: VEIL_CLEAR_MS,
          easing: Easing.in(Easing.quad),
        })
        tug.value = withTiming(0, {
          duration: RETURN_MS,
          easing: Easing.out(Easing.quad),
        })
        wave.value = 0
        wave.value = withTiming(1, { duration: beats.wave, easing: Easing.linear })
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
        onSwitch()
      }, beats.click),
      setTimeout(onDone, beats.done),
    ]
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [])

  const hangStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -raised.value * (CORD + 2 * BEAD_RY) }],
  }))
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }))

  return (
    <View className="absolute inset-0" pointerEvents="none" aria-hidden>
      <Animated.View className="absolute inset-0 bg-black" style={veilStyle} />
      <Animated.View
        className="absolute left-0 right-0 top-0 items-center"
        style={hangStyle}
      >
        <Hanging
          bulb={<SwitchedBulb lit={lit} />}
          cord={<Cord tug={tug} wave={wave} />}
        />
      </Animated.View>
    </View>
  )
}
