import { useEffect } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { carvedCellAt, carveOf, cellRect } from '@/lib/dial-carve'
import {
  allowedMove,
  cellAt,
  crossReach,
  exitMove,
  exitMoveFrom,
  liftMove,
  mirrorMove,
  nextValue,
  NO_COMMAND,
  orientMove,
  travelled,
  type DialCommand,
  type DialMove,
} from '@/lib/dial-gesture'
import type { DialMetrics } from '@/lib/dial-metrics'
import type { DialControl } from '@/machines/tutorial-lesson'
import { cellsOf, type DialSpec } from '@/modes'

// The one pan over the dial, and what it tells the keys — see `Dial` for why it is one
// gesture rather than one per key.
//
// Everything here is the gesture's: its copy of the grid, the key under the thumb, the
// commands it sends each key on the UI thread, and the count of changes still travelling.
// The dial hands it the geometry and the digits it is drawing, and draws what comes back.

const noCommands = (dial: DialSpec): readonly DialCommand[] =>
  cellsOf(dial).map(() => NO_COMMAND)

// No key under the thumb.
const NONE = -1

export function useDialPan({
  dial,
  values,
  metrics,
  carved,
  carve,
  live,
  drag,
  hitSeq,
  onSweep,
}: {
  dial: DialSpec
  values: readonly number[]
  metrics: DialMetrics
  // Whether the dial is **proportional**, and so whether `carve` is read.
  carved: boolean
  carve: SharedValue<number[]>
  live: readonly DialControl[]
  drag: boolean
  hitSeq: number
  onSweep?: () => void
}) {
  // What the pan has told each key to do, and which key is under the thumb. Read on the
  // UI thread by the nine keys themselves, so each one animates in the frame the finger
  // leaves it rather than a render later.
  const commands = useSharedValue(noCommands(dial))
  const pressed = useSharedValue(NONE)

  // The grid as the gesture sees it, which is ahead of the one it is drawing. A press
  // takes a render to come back as a new `values`, and one drag can cross three keys
  // inside that render — so the pan keeps its own copy and updates it as it goes, or it
  // would read a key it just set to 9 as still holding what the key held when the finger
  // went down, and suppress the next change to it as a no-op.
  const held = useSharedValue(values)

  // How many changes have been decided but not yet sent, which is what says whether the
  // copy above is still ahead. A key's change leaves on the back half of its digit
  // animation, so the pan can be several presses in front of the machine for a moment.
  const inFlight = useSharedValue(0)

  // What the pan asks of the geometry, which is the one place the keys' sizes matter to it:
  // which key a point is in, which side of it the finger left by, and how far across it the
  // finger has to get. A proportional dial answers each from the cuts as they stand this
  // frame, so the key it hears is the key on the screen.
  const locate = (x: number, y: number) => {
    'worklet'
    return carved
      ? carvedCellAt(x, y, carve.value, metrics, dial)
      : cellAt(x, y, metrics, dial)
  }
  const leave = (cell: number, x: number, y: number) => {
    'worklet'
    if (!carved) return exitMove(cell, x, y, metrics, dial.cols)
    const rect = cellRect(cell, carve.value, metrics, dial)
    return exitMoveFrom(rect.x + rect.width / 2, rect.y + rect.height / 2, x, y)
  }
  const reachOf = (cell: number) => {
    'worklet'
    if (!carved) return crossReach(metrics)
    const rect = cellRect(cell, carve.value, metrics, dial)
    return crossReach(metrics, Math.min(rect.width, rect.height))
  }

  const active = useSharedValue<number | null>(null)
  // The key the finger came down on, which is the one key a graze cannot happen on.
  const landed = useSharedValue<number | null>(null)
  // Where the finger entered the key it is in now, which is what a lift is measured from.
  const entryX = useSharedValue(0)
  const entryY = useSharedValue(0)
  // Whether this gesture has left a key yet. A bare tap only counts on the key the whole
  // gesture began on, so a key the finger merely crossed and stopped over is left alone.
  const crossed = useSharedValue(false)

  // The last key this gesture actually changed, and whether it has already been called a
  // drag. Together they are the whole of what `onSweep` needs: a second *different* key
  // moved without the finger lifting. Different, because a finger that wanders off a key
  // and comes back changes it twice having swept nothing — and already-called, because the
  // third key of a sweep is the same news as the second.
  const lastCommit = useSharedValue(NONE)
  const swept = useSharedValue(false)

  // A run on another dial, which is the one thing that changes the *shape* of everything
  // above rather than its contents.
  //
  // Both copies are made once, at mount, and are as long as the dial had keys then — and
  // this component is never unmounted between runs: every screen but the game itself is
  // an overlay stacked over it, so the intro, the pause and the game-over screen all come
  // and go above a dial that stays. `commit` writes through `map`, which cannot grow an
  // array, so a sixteen-key challenge opened after a nine-key run was left with nine
  // command slots: keys ten upwards had nowhere to be told they had moved, and so never
  // animated, never called back, and read as dead to every gesture. A dial *smaller* than
  // the one before it never showed this, because its keys all fit in the slots it
  // inherited — which is why four keys was fine and sixteen was not.
  //
  // Keyed on the dial's own id, which is what tells one dial from another everywhere else
  // — see `DialSpec`.
  useEffect(() => {
    commands.value = noCommands(dial)
    held.value = values
    // Snapped rather than eased: the cut of the dial before has a different number of lanes,
    // and a timing cannot run between two lists of different lengths.
    carve.value = carveOf(dial, values)
    // Nothing is in flight to a dial that is not on screen any more. Cleared so the
    // effect below is not held off by a count left over from the run before.
    inFlight.value = 0
  }, [dial.id])

  // A grid that arrived while the copy could not take it — see below — kept until the
  // gesture it arrived during is over.
  const owedGrid = useSharedValue<readonly number[] | null>(null)

  // Whether a **scramble** has landed under the gesture now in progress. The rest of that
  // gesture is then ignored, up to the finger lifting: a drag is planned against the digits
  // the keys showed when it began, and once they have all moved it has nothing left to
  // mean. Its moves would also be read against the copy above, which cannot take the
  // scrambled grid until the finger is up — see the effect below.
  const interrupted = useSharedValue(false)
  useEffect(() => {
    if (dial.scramble && active.value !== null) interrupted.value = true
  }, [hitSeq])

  // Where the copy is put right again — the two things that change the grid from outside
  // the dial are a new run starting and a hit **scrambling** it, and this is how the pan
  // hears about either.
  //
  // Not at the start of each gesture, which is the tempting place and the wrong one: a
  // finger can come back down inside the beat a previous change is still travelling in,
  // and re-reading the render there would undo it.
  //
  // A scramble can land while a finger is still down — a drag that takes a target on its
  // way through — and nothing after it need change the grid again, so a render this skips
  // is kept for the gesture's end rather than dropped.
  useEffect(() => {
    if (active.value !== null || inFlight.value > 0) {
      owedGrid.value = values
      return
    }
    owedGrid.value = null
    held.value = values
  }, [values])

  // `move` arrives as the finger made it on the screen, and is turned into the dial's
  // own here and nowhere earlier — see `orientMove`, then `mirrorMove`. The tutorial's
  // controls are read after both, which an upright, unmirrored dial changes nothing about.
  const commit = (cell: number, move: DialMove, lift: boolean) => {
    'worklet'
    if (interrupted.value) return
    const taken = allowedMove(
      live[cell] ?? 'full',
      mirrorMove(dial.mirror, orientMove(dial.orientation, move)),
      lift,
    )
    if (taken === null) return
    // A second key, where one gesture may only move one. Refused here rather than at the
    // end of the gesture, so a drag that is not allowed simply leaves the keys it crosses
    // where they were instead of moving them and taking it back a moment later. The key
    // this gesture has already moved is still its own — leaving a key and coming back to
    // it is one key moved twice, not a drag.
    if (!drag && lastCommit.value !== NONE && lastCommit.value !== cell) return
    const was = held.value[cell] ?? 0
    const now = nextValue(taken, was, dial.digits)
    // Nothing to do, and so nothing to say: sliding off the right of a key already on 9
    // is not a press, and animating one would promise a change that never arrives.
    if (now === was) return
    // Part of a drag from the second key it moves onwards — a key revisited after another
    // one included, since by then the gesture already was one.
    const sweep = swept.value || (lastCommit.value !== NONE && lastCommit.value !== cell)
    // A second key moved on the same gesture, which is a drag and nothing else can be.
    // Said before the change rather than after, so the lesson it ends is already out of
    // the way by the time the keys it swept finish animating.
    if (lastCommit.value !== NONE && lastCommit.value !== cell && !swept.value) {
      swept.value = true
      if (onSweep !== undefined) scheduleOnRN(onSweep)
    }
    lastCommit.value = cell
    inFlight.value += 1
    held.value = held.value.map((v, i) => (i === cell ? now : v))
    commands.value = commands.value.map((c, i) =>
      i === cell ? { seq: c.seq + 1, move: taken, sweep } : c,
    )
  }

  const enter = (cell: number | null, x: number, y: number) => {
    'worklet'
    active.value = cell
    entryX.value = x
    entryY.value = y
    pressed.value = cell !== null && live[cell] !== 'off' ? cell : NONE
  }

  const gesture = Gesture.Pan()
    .minDistance(0)
    // Nothing to hear where the lesson has shut every key, and engaging anyway would
    // swallow the tap the card over the dial is waiting for.
    .enabled(live.some((control) => control !== 'off'))
    .onBegin((e) => {
      'worklet'
      crossed.value = false
      interrupted.value = false
      lastCommit.value = NONE
      swept.value = false
      landed.value = locate(e.x, e.y)
      enter(landed.value, e.x, e.y)
    })
    .onUpdate((e) => {
      'worklet'
      const cell = locate(e.x, e.y)
      if (cell === active.value) return
      const left = active.value
      if (left !== null) {
        const move = leave(left, e.x, e.y)
        // Still on the key the finger came down on, which takes every exit — and not
        // merely `left === landed.value`, since a finger that wanders off the dial and
        // back onto that key arrived at it like any other.
        const own = left === landed.value && !crossed.value
        const far =
          travelled(move, e.x - entryX.value, e.y - entryY.value) >= reachOf(left)
        crossed.value = true
        if (own || far) commit(left, move, false)
      }
      enter(cell, e.x, e.y)
    })
    .onEnd((e) => {
      'worklet'
      const cell = active.value
      if (cell === null) return
      const move = liftMove(
        e.x - entryX.value,
        e.y - entryY.value,
        crossed.value,
        reachOf(cell),
      )
      if (move === null) return
      commit(cell, move, true)
    })
    .onFinalize(() => {
      'worklet'
      active.value = null
      pressed.value = NONE
      // The grid a scramble left while the finger was down. Only with nothing in flight:
      // a change still travelling will render the grid again once it lands, and that
      // render is the one to take.
      const owed = owedGrid.value
      if (owed === null || inFlight.value > 0) return
      owedGrid.value = null
      held.value = owed
    })

  return { gesture, commands, pressed, inFlight }
}
