import { useEffect } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { DialButton } from '@/components/game/dial-button'
import { DEFAULT_DIAL_CORNERS, type DialCorners } from '@/constants/dial-hints'
import { useDialMetrics } from '@/hooks/use-dial-metrics'
import {
  allowedMove,
  cellAt,
  crossReach,
  exitMove,
  liftMove,
  nextValue,
  NO_COMMAND,
  travelled,
  type DialCommand,
  type DialMove,
} from '@/lib/dial-gesture'
import type { DialControl } from '@/machines/tutorial-lesson'
import { cellsOf, weightAt, type DialSpec } from '@/modes'

// Every key live, which is every run but a guided tutorial route.
const allLive = (dial: DialSpec): readonly DialControl[] =>
  cellsOf(dial).map(() => 'full')

const noCommands = (dial: DialSpec): readonly DialCommand[] =>
  cellsOf(dial).map(() => NO_COMMAND)

// No key under the thumb.
const NONE = -1

// The keys the dial lays out, and the single pan that reads all of them.
//
// One gesture rather than one each, because a pan only ever reports to the view the
// finger landed on: nine of them could each hear their own key and nothing else, so a
// drag across the dial was one press and eight keys it passed over in silence. Here the
// pan owns the box, works out which key the finger is in, and a key commits the moment
// the finger *leaves* it — by the side it left through, not by where the gesture ends.
// Wander over a key, change your mind, come back: only the way out counts. The gesture
// never has to end, so one drag can reset a row.
//
// A key the finger arrived at also has to have been properly crossed: a swipe aimed at
// one key clips the pill of the next often enough that every neighbour answering to a
// graze cost the player digits they never asked for. So such a key answers only once the
// finger has spent `crossReach` of it going the way it leaves by — see `travelled`. The
// key the finger *landed* on is exempt: the player put it there, so however they take it
// off is what they meant.
//
// Every key it changes is one press to the machine, exactly as if it had been swiped on
// its own, so a run scored the long way is scored the same way here.
export function Dial({
  dial,
  values,
  isDark,
  showSum,
  trainee,
  peakFrom,
  peakTo,
  corners = DEFAULT_DIAL_CORNERS,
  controls,
  liveKey = null,
  onDelta,
  onSet,
  onSweep,
}: {
  // The dial being drawn: how many keys, how they are arranged, what each is worth and
  // how far a digit goes. Everything in here that used to be a nine or a three.
  dial: DialSpec
  // The digits, row-major.
  values: readonly number[]
  isDark: boolean
  showSum: boolean
  trainee: boolean
  peakFrom: string
  peakTo: string
  corners?: DialCorners
  // What each key will take. `full` everywhere but the tutorial's guided route — see
  // machines/tutorial-lesson.ts.
  controls?: readonly DialControl[]
  // The key the tutorial is pointing at, wearing the halo that says so.
  liveKey?: number | null
  onDelta: (index: number, delta: 1 | -1) => void
  onSet: (index: number, value: number) => void
  // Said once, the moment one gesture moves a second key — the one thing a run of separate
  // swipes cannot do, and so the only way to know a drag was a drag. Every key it moves
  // still reports itself through `onDelta` / `onSet`; this says they came together. The
  // tutorial's last lesson is the only thing listening.
  onSweep?: () => void
}) {
  const metrics = useDialMetrics(dial)
  const live = controls ?? allLive(dial)

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

  // Where the copy is put right again — the only thing that ever changes the grid from
  // outside the dial is a new run starting, and this is how the pan hears about it.
  //
  // Not at the start of each gesture, which is the tempting place and the wrong one: a
  // finger can come back down inside the beat a previous change is still travelling in,
  // and re-reading the render there would undo it.
  useEffect(() => {
    if (active.value !== null || inFlight.value > 0) return
    held.value = values
  }, [values])

  const commit = (cell: number, move: DialMove, lift: boolean) => {
    'worklet'
    const taken = allowedMove(live[cell] ?? 'full', move, lift)
    if (taken === null) return
    const was = held.value[cell] ?? 0
    const now = nextValue(taken, was, dial.digits)
    // Nothing to do, and so nothing to say: sliding off the right of a key already on 9
    // is not a press, and animating one would promise a change that never arrives.
    if (now === was) return
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
      i === cell ? { seq: c.seq + 1, move: taken } : c,
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
      lastCommit.value = NONE
      swept.value = false
      landed.value = cellAt(e.x, e.y, metrics, dial)
      enter(landed.value, e.x, e.y)
    })
    .onUpdate((e) => {
      'worklet'
      const cell = cellAt(e.x, e.y, metrics, dial)
      if (cell === active.value) return
      const left = active.value
      if (left !== null) {
        const move = exitMove(left, e.x, e.y, metrics, dial.cols)
        // Still on the key the finger came down on, which takes every exit — and not
        // merely `left === landed.value`, since a finger that wanders off the dial and
        // back onto that key arrived at it like any other.
        const own = left === landed.value && !crossed.value
        const far =
          travelled(move, e.x - entryX.value, e.y - entryY.value) >= crossReach(metrics)
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
        crossReach(metrics),
      )
      if (move === null) return
      commit(cell, move, true)
    })
    .onFinalize(() => {
      'worklet'
      active.value = null
      pressed.value = NONE
    })

  return (
    // The margin is the dial's own, not the screen's: the keys sit at the bottom of every
    // screen that draws them, and the room under the last row is part of the dial being
    // comfortable to swipe on rather than a decision the game, the room and the arcade
    // each make for themselves.
    <View className="mb-6 items-center">
      <GestureDetector gesture={gesture}>
        <View
          style={{ width: metrics.width, height: metrics.height, gap: metrics.gap }}
          className="flex-row flex-wrap"
        >
          {cellsOf(dial).map((index) => (
            <DialButton
              key={index}
              index={index}
              value={values[index] ?? 0}
              isDark={isDark}
              size={metrics.button}
              weight={weightAt(dial, index)}
              digits={dial.digits}
              showSum={showSum}
              trainee={trainee}
              corners={corners}
              control={live[index] ?? 'full'}
              hinted={liveKey === index}
              peakFrom={peakFrom}
              peakTo={peakTo}
              commands={commands}
              pressed={pressed}
              inFlight={inFlight}
              onDelta={(delta) => {
                onDelta(index, delta)
              }}
              onSet={(value) => {
                onSet(index, value)
              }}
            />
          ))}
        </View>
      </GestureDetector>
    </View>
  )
}
