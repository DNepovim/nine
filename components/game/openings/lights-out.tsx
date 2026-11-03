import * as Haptics from 'expo-haptics'
import { useEffect, type ReactNode } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { LIGHTS_OUT } from '@/constants/colors'
import type { OpeningTake } from '@/modes'

// BLACKOUT's **opening**: the lights going out.
//
// A bulb hangs into the top of the game screen on its flex, lit, with a pull-cord beside
// it. The cord is tugged, the bulb clicks off — a haptic with the click — and in that
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
// room a beat to settle after the click before the first target arrives.
const BEATS = {
  full: { drop: 650, tug: 1100, click: 1350, done: 2100 },
  // The tug runs its whole `TUG_MS` before the click, as in the full take, so the cord
  // reaches the bottom of its pull rather than being snapped back mid-way.
  short: { drop: 0, tug: 0, click: 250, done: 650 },
} as const satisfies Record<
  OpeningTake,
  { drop: number; tug: number; click: number; done: number }
>

// How far the bulb hangs below the top of the screen, and the flash's clearing time.
const HANG = 150
const VEIL_CLEAR_MS = 480
const TUG_MS = 250
const RETURN_MS = 200
// How far a tug draws the cord down.
const TUG_REACH = 26
// How far the cord hangs below the top of the flex, bead not included.
const CORD = HANG + 70

const BULB_WIDTH = 96
const BULB_HEIGHT = 120

// The glass on a 24-unit square, as the mark draws it, scaled up to the bulb's box.
const GLASS =
  'M12 2.2 C7.7 2.2 5 5.4 5 9.2 C5 11.8 6.3 13.4 7.7 14.8 C8.6 15.7 9 16.5 9 17.6 ' +
  'H15 C15 16.5 15.4 15.7 16.3 14.8 C17.7 13.4 19 11.8 19 9.2 C19 5.4 16.3 2.2 12 2.2 Z'
const FILAMENT = 'M10 17.4 V13.4 L11 11.8 L12 13.4 L13 11.8 L14 13.4 V17.4'

// The bulb, drawn lit or dead. Module-level, so the scene's re-renders never remount it.
function Bulb({ lit }: { lit: boolean }) {
  return (
    <Svg width={BULB_WIDTH} height={BULB_HEIGHT} viewBox="0 0 24 30">
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

// The pull-cord: its length and the bead a finger would close on.
function Cord() {
  return (
    <>
      <View style={{ width: 1.5, height: CORD, backgroundColor: LIGHTS_OUT.line }} />
      <View
        className="rounded-full"
        style={{ width: 10, height: 14, backgroundColor: LIGHTS_OUT.line }}
      />
    </>
  )
}

// The cord, drawn down by a tug.
function PullCord({ tug }: { tug: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: tug.value * TUG_REACH }],
  }))
  return (
    <Animated.View className="items-center" style={style}>
      <Cord />
    </Animated.View>
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
      <View style={{ marginLeft: 10 }}>{cord}</View>
    </View>
  )
}

// What the scene leaves behind: the dead bulb, hanging grey over the run for as long as it
// lasts — the room the player is playing in is the one whose light they just watched go
// out. Drawn behind the targets and the dial, and never pressable.
export function LightsOutRemains() {
  return (
    <View
      className="absolute left-0 right-0 top-0 items-center"
      pointerEvents="none"
      aria-hidden
    >
      <Hanging
        bulb={<Bulb lit={false} />}
        cord={
          <View className="items-center">
            <Cord />
          </View>
        }
      />
    </View>
  )
}

export function LightsOut({ take, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]
  // 0 is hanging in place; 1 is above the top of the screen, where the full take starts.
  const raised = useSharedValue(take === 'full' ? 1 : 0)
  const tug = useSharedValue(0)
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
    transform: [{ translateY: -raised.value * (HANG + BULB_HEIGHT) }],
  }))
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }))

  return (
    <View className="absolute inset-0" pointerEvents="none" aria-hidden>
      <Animated.View className="absolute inset-0 bg-black" style={veilStyle} />
      <Animated.View
        className="absolute left-0 right-0 top-0 items-center"
        style={hangStyle}
      >
        <Hanging bulb={<SwitchedBulb lit={lit} />} cord={<PullCord tug={tug} />} />
      </Animated.View>
    </View>
  )
}
