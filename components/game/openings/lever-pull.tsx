import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  Easing,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import {
  LEVER_H,
  LEVER_TRAVEL,
  LEVER_W,
  LeverDrawing,
  useLeverBox,
} from '@/components/game/openings/lever-drawing'
import { LeverInScene } from '@/components/game/openings/lever-in-scene'
import { LeverMarquee, runMarquee } from '@/components/game/openings/lever-marquee'
import type { RunFigures } from '@/lib/vitals'
import type { OpeningTake } from '@/modes'

// SCRAMBLE's **opening**: a slot machine switched on and played.
//
// The game screen is the casino's red velvet from its first frame, the marquee of bulbs round
// its edge all off and the rows above the dial dark. The bulbs light one after another round the
// circle, and when the ring is closed the rows above the dial flash on like a bulb catching. Then
// the lever on the right is pulled down, and that shuffles the dial: the keys spin like reels and
// stop one after another, and the run begins on the dial they land on.
//
// What stays for the run is the scene's **remains**: the bulbs blinking, odd and even in turn,
// and running round the edge when a hit carries the streak on (`CasinoRemains`); and the lever
// (`LeverOver`), in front of the run and the player's to pull — dragged down and let go it
// shuffles the dial again. When the run is over the bulbs go out one after another, the way they
// came on, and the game-over screen waits for the last of them (`lightsOutLeft`).
//
// The `short` take is for a run dealt again: the same sequence, quickly.

// When each beat lands, in ms from the scene's start, per take: the bulbs begin to light and how
// long the ring takes to close, the flash of the rows above the dial, the lever starts down and
// how long it takes, the reels' clicks as they stop (after the shuffle), and the end.
const BEATS = {
  full: {
    light: 250,
    ring: 1100,
    flash: 1550,
    pull: 2050,
    pullMs: 520,
    clicks: [450, 650, 850],
    done: 4000,
  },
  short: {
    light: 0,
    ring: 320,
    flash: 400,
    pull: 520,
    pullMs: 220,
    clicks: [450],
    done: 1750,
  },
} as const satisfies Record<
  OpeningTake,
  {
    light: number
    ring: number
    flash: number
    pull: number
    pullMs: number
    clicks: readonly number[]
    done: number
  }
>

// How much of the way down a drag has to take the knob to count as a pull.
const PULLED = 0.7

// How dark the rows above the dial are until the scene lights them.
const BAR_OFF = 0.12

// How long the bulbs take to go out round the circle at the end of a run, and the beat the
// game-over screen waits after the last of them.
const OUT_MS = 1000
const OUT_PAUSE_MS = 200

function click() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

function clunk() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
}

function flick() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}

// When the bulbs began to go out at the end of the run, so the game-over screen can wait for them.
// Nought while they are not going out.
let outAt = 0

// How long, in ms, until the bulbs have gone out and the beat after them has passed, or nought
// where they are not going out.
export function lightsOutLeft(): number {
  return outAt === 0 ? 0 : Math.max(0, outAt + OUT_MS + OUT_PAUSE_MS - Date.now())
}

// The marquee as the run keeps it, behind the dial: the odd and even bulbs blinking in turn, and
// the lights run round the edge by every hit that carries the streak a step further. When the run
// is over (`finished`) every bulb is lit and they go out one after another.
export function CasinoRemains({
  figures,
  finished,
}: {
  figures: RunFigures
  finished: boolean
}) {
  const blink = useSharedValue(1)
  const fill = useSharedValue(0)
  const out = useSharedValue(0)
  const solid = useSharedValue(1)
  // The streak as it stood when this mounted is not a hit.
  const seen = useRef(figures.streak)
  useEffect(() => {
    if (figures.streak > seen.current) runMarquee()
    seen.current = figures.streak
  }, [figures.streak])

  useEffect(() => {
    if (!finished) {
      outAt = 0
      return
    }
    outAt = Date.now()
    blink.value = withTiming(0, { duration: 120 })
    fill.value = 1
    out.value = 0
    out.value = withTiming(1, { duration: OUT_MS, easing: Easing.linear })
  }, [finished])

  return <LeverMarquee blink={blink} fill={fill} out={out} solid={solid} />
}

// The lever through the run, in front of everything, and the player's: drag the knob down and let
// go to shuffle the dial. It springs back at once, and is not pulled again until it has — a pull
// is a pull, not a drag held on. Dead while the run is paused or over.
export function LeverOver({
  running,
  onShuffle,
}: {
  running: boolean
  onShuffle: () => void
}) {
  const { top } = useLeverBox()
  const pull = useSharedValue(0)
  const busy = useSharedValue(false)
  const live = useSharedValue(running)

  useEffect(() => {
    live.value = running
  }, [running])

  const pulled = () => {
    clunk()
    onShuffle()
  }

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (!live.value || busy.value) return
      pull.value = Math.min(1, Math.max(0, event.translationY / LEVER_TRAVEL))
    })
    .onEnd(() => {
      if (!live.value || busy.value) return
      const thrown = pull.value >= PULLED
      if (thrown) {
        busy.value = true
        scheduleOnRN(pulled)
      }
      pull.value = withTiming(
        0,
        { duration: thrown ? 420 : 200, easing: Easing.out(Easing.cubic) },
        () => {
          busy.value = false
        },
      )
    })

  return (
    <View className="absolute inset-0" pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <View
          style={{ position: 'absolute', right: 0, top, width: LEVER_W, height: LEVER_H }}
        >
          <LeverDrawing pull={pull} />
        </View>
      </GestureDetector>
    </View>
  )
}

export function LeverPull({
  take,
  barLight,
  onShuffle,
  onSwitch,
  onDone,
}: OpeningSceneProps) {
  const beats = BEATS[take]
  const blink = useSharedValue(0)
  const fill = useSharedValue(0)
  const out = useSharedValue(0)
  const solid = useSharedValue(1)
  const pull = useSharedValue(0)

  useEffect(() => {
    // Everything dark: the bulbs off, and the rows above the dial with them.
    barLight.value = BAR_OFF
    fill.value = withDelay(
      beats.light,
      withTiming(1, { duration: beats.ring, easing: Easing.linear }),
    )
    // The rows catch like a bulb: on, back, on, a flutter, and steady.
    barLight.value = withDelay(
      beats.flash,
      withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(0.35, { duration: 70 }),
        withTiming(1, { duration: 50 }),
        withTiming(0.6, { duration: 60 }),
        withTiming(1, { duration: 90 }),
      ),
    )
    // The lever goes down and springs back; at the bottom the dial is shuffled and the bulbs
    // start to blink where they had been lit all round.
    pull.value = withSequence(
      withDelay(
        beats.pull,
        withTiming(1, { duration: beats.pullMs, easing: Easing.in(Easing.quad) }),
      ),
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
    )
    const shuffleAt = beats.pull + beats.pullMs
    blink.value = withDelay(shuffleAt, withTiming(1, { duration: 300 }))
    solid.value = withDelay(shuffleAt, withTiming(0, { duration: 300 }))
    const timers = [
      setTimeout(onSwitch, 0),
      // A tick for every few bulbs as they light.
      ...[0.25, 0.5, 0.75].map((share) =>
        setTimeout(click, beats.light + share * beats.ring),
      ),
      setTimeout(flick, beats.flash),
      setTimeout(() => {
        clunk()
        onShuffle()
      }, shuffleAt),
      ...beats.clicks.map((at) => setTimeout(click, shuffleAt + at)),
      setTimeout(onDone, beats.done),
    ]
    return () => {
      timers.forEach(clearTimeout)
      barLight.value = 1
    }
  }, [])

  return (
    <View className="absolute inset-0" pointerEvents="none">
      <LeverMarquee blink={blink} fill={fill} out={out} solid={solid} />
      <LeverInScene pull={pull} />
    </View>
  )
}
