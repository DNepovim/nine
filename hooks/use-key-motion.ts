import { useEffect, useRef } from 'react'
import {
  Easing,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import {
  MOVE_EFFECT,
  NO_COMMAND,
  type DialCommand,
  type DialMove,
} from '@/lib/dial-gesture'

// How far a digit comes from as a scrambled dial's key stops, and how long each key waits for the
// one before it: a row of reels coming to rest.
const REEL_DROP = 40
const REEL_STAGGER_MS = 70
// How long a reel's blur runs before it stops, and how long one lap of it takes.
const REEL_SPIN_MS = 450
const REEL_LAP_MS = 180

// Which way the digit leaves for each move. Up and right raise the key, so the old
// digit is pushed off the top; down and left lower it, so it drops off the bottom.
// A tap has no flip at all — it pops the digit in place — so it is not in here.
const FLIP_DIR = {
  up: -1,
  right: -1,
  down: 1,
  left: 1,
} as const satisfies Record<Exclude<DialMove, 'tap'>, 1 | -1>

// The squash under a thumb and its release. Stiffer going in than coming out: arriving
// under the finger should read as instant, leaving as settling.
export const PRESS_SCALE = 0.94
const PRESS_IN = { damping: 20, stiffness: 260 }
const PRESS_OUT = { damping: 16, stiffness: 140 }

// How one key moves when the dial's pan tells it to: the digit flying out and back, a
// scramble's digit arriving, a tap's pop, and the squash under the thumb — and the press it
// owes the machine, sent as the digit comes back in. See `useDialPan` for the pan itself.
export function useKeyMotion({
  index,
  value,
  digits,
  scrambles,
  reel,
  commands,
  pressed,
  inFlight,
  onDelta,
  onSet,
}: {
  index: number
  value: number
  digits: number
  scrambles: number
  // Whether the key is drawn as a reel, which spins before a scramble's digit stops.
  reel: boolean
  commands: SharedValue<readonly DialCommand[]>
  pressed: SharedValue<number>
  inFlight: SharedValue<number>
  onDelta: (delta: 1 | -1, sweep: boolean) => void
  onSet: (value: number, sweep: boolean) => void
}) {
  const scale = useSharedValue(1)
  // The pill's bounce on a flip, along whichever screen axis the dial's vertical lies on.
  const bounce = useSharedValue(0)
  const numTranslateY = useSharedValue(0)
  const numOpacity = useSharedValue(1)
  const numScale = useSharedValue(1)
  // Whether this key is a reel and it is spinning, and how far round a lap of its blur it has got.
  const reelSpin = useSharedValue(0)
  const reelStrip = useSharedValue(0)

  // What this key owes the machine: a change whose digit has flown out but not yet flown
  // back in. The event is sent on the way back, so the digit and the sum above the dial
  // turn over together — but a finger crossing this key again before then cancels that
  // animation, and the event would go with it. So a new move pays off the old one first,
  // and a scrub the animation cannot keep up with loses frames rather than presses.
  const owed = useSharedValue<DialCommand | null>(null)

  const fire = ({ move, sweep }: DialCommand) => {
    'worklet'
    inFlight.value -= 1
    const { step, set } = MOVE_EFFECT[move]
    // `set` names an end of the key's range rather than a digit — how high a key goes is
    // the board's business — so the end is turned into a value here.
    if (step === null) scheduleOnRN(onSet, set === 'floor' ? 0 : digits - 1, sweep)
    else scheduleOnRN(onDelta, step, sweep)
  }

  const settle = () => {
    'worklet'
    const command = owed.value
    if (command === null) return
    owed.value = null
    fire(command)
  }

  // The digit leaves the way the finger sent it and comes back from the other side.
  const animateFlip = (dir: 1 | -1) => {
    'worklet'
    bounce.value = withSequence(
      withTiming(dir * 7, { duration: 100 }),
      withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
    )

    numOpacity.value = withTiming(0, { duration: 110 })
    numTranslateY.value = withTiming(dir * 18, { duration: 110 }, (finished) => {
      if (!finished) return
      settle()
      numTranslateY.value = dir * -18
      numTranslateY.value = withSpring(0, { damping: 22, stiffness: 160 })
      numOpacity.value = withTiming(1, { duration: 130 })
    })
  }

  // A **scramble**: the digit has already changed under the key, so there is no flight to
  // be owed across and nothing to send — only the new digit arriving, from below when it
  // rose and from above when it fell, the way a swipe would have brought it in. It arrives like
  // a reel stopping: from further off, and each key a beat after the one before it, so the dial
  // comes to rest key by key rather than all at once.
  const animateArrival = (dir: 1 | -1) => {
    'worklet'
    const wait = index * REEL_STAGGER_MS
    // A reel spins — a blur of digits — until it stops on the digit; any other key drops it in.
    const stop = reel ? wait + REEL_SPIN_MS : wait
    if (reel) {
      reelSpin.value = 1
      reelStrip.value = 0
      reelStrip.value = withRepeat(
        withTiming(1, { duration: REEL_LAP_MS, easing: Easing.linear }),
        Math.ceil(stop / REEL_LAP_MS) + 1,
      )
      reelSpin.value = withDelay(stop, withTiming(0, { duration: 90 }))
    }
    bounce.value = withDelay(
      stop,
      withSequence(
        withTiming(dir * 7, { duration: 100 }),
        withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
      ),
    )
    numOpacity.value = 0
    numTranslateY.value = dir * -REEL_DROP
    numTranslateY.value = withDelay(stop, withSpring(0, { damping: 22, stiffness: 160 }))
    numOpacity.value = withDelay(stop, withTiming(1, { duration: 130 }))
  }

  // What this key last showed, and under which scramble — so a value arriving with a new
  // count can be told from one the player's own press brought, which has had its flip.
  //
  // A key with a flip still in the air is left to finish it. The flip comes back in with
  // whatever digit the key shows by then, which is the scrambled one, and its own callback
  // is what sends the press it owes: an arrival drawn over it would cancel that callback,
  // and the press would never reach the machine.
  const seen = useRef({ value, scrambles })
  useEffect(() => {
    const was = seen.current
    seen.current = { value, scrambles }
    if (scrambles === was.scrambles || value === was.value) return
    if (owed.value !== null) return
    animateArrival(value > was.value ? 1 : -1)
  }, [value, scrambles])

  const animateTap = () => {
    'worklet'
    numScale.value = withSequence(
      withTiming(1.15, { duration: 90 }),
      withSpring(1, { damping: 18, stiffness: 160 }),
    )
  }

  const run = (command: DialCommand) => {
    'worklet'
    settle()
    // A tap has nothing to wait for: the digit pops where it stands rather than leaving,
    // so there is no flight for the press to be owed across.
    if (command.move === 'tap') {
      animateTap()
      fire(command)
      return
    }
    owed.value = command
    animateFlip(FLIP_DIR[command.move])
  }

  // The squash follows the thumb rather than belonging to a press. One gesture crosses
  // several keys now, and each takes the squash as the finger arrives and gives it up as
  // it leaves — so what is under the finger is always the key that is about to change.
  useAnimatedReaction(
    () => pressed.value === index,
    (down, was) => {
      if (down === was) return
      scale.value = withSpring(down ? PRESS_SCALE : 1, down ? PRESS_IN : PRESS_OUT)
    },
  )

  // How a key hears that the pan just left it. Keyed on the counter rather than the move:
  // leaving the same key the same way twice running is two changes, and comparing the
  // moves would see one.
  useAnimatedReaction(
    () => commands.value[index] ?? NO_COMMAND,
    (command, previous) => {
      if (previous === null || command.seq === previous.seq) return
      run(command)
    },
  )

  return { scale, bounce, numTranslateY, numOpacity, numScale, reelSpin, reelStrip }
}
