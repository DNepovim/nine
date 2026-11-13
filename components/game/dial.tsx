import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { Arrival, DIAL_ORDER } from '@/components/game/arrival'
import { DialAxes } from '@/components/game/dial-axes'
import { DialButton } from '@/components/game/dial-button'
import { DialFlames, useBurn } from '@/components/game/dial-flames'
import { DialSketch } from '@/components/game/dial-sketch'
import { GestureHint } from '@/components/game/gesture-hint'
import { DEFAULT_DIAL_CORNERS, type DialCorners } from '@/constants/dial-hints'
import { useDialMetrics } from '@/hooks/use-dial-metrics'
import { useDialPan } from '@/hooks/use-dial-pan'
import { reportTileGrid } from '@/hooks/use-tile-grid'
import { useViewport } from '@/hooks/use-viewport'
import { carveOf, cellRect } from '@/lib/dial-carve'
import type { DialMetrics } from '@/lib/dial-metrics'
import { DRAW, phaseOf } from '@/lib/dial-sketch'
import type { DialControl, HandGesture } from '@/machines/tutorial-lesson'
import { cellsOf, weightAt, type DialSpec } from '@/modes'

// Every key live, which is every run but a guided tutorial route.
const allLive = (dial: DialSpec): readonly DialControl[] =>
  cellsOf(dial).map(() => 'full')

// A key's own wrapper, when the box around it is what sets its size.
const FILL = { flex: 1 } as const

// How long a proportional dial takes to move its cuts to the next position — about as long
// as a key's tint takes to change, so the two settle together.
const CARVE_TIMING = { duration: 240, easing: Easing.out(Easing.quad) }

// How big a digit is drawn on a dial of one key, which has the whole of the room to itself.
const SOLE_DIGIT = 84

// How far down the screen the middle of the dial stands, near enough for an edge sweeping past.
const DIAL_MIDDLE = 0.72

// Where a key stands along the diagonal an opening's edge sweeps, nought at the top-left corner
// and one at the bottom-right: the average of how far across and how far down it is.
const sweepPlaceOf = (
  index: number,
  dial: DialSpec,
  metrics: { button: number; gap: number },
  screen: { width: number; height: number },
): number => {
  const pitch = metrics.button + metrics.gap
  const across =
    0.5 + (((index % dial.cols) - (dial.cols - 1) / 2) * pitch) / screen.width
  const row = Math.floor(index / dial.cols)
  const down = DIAL_MIDDLE + ((row - (dial.rows - 1) / 2) * pitch) / screen.height
  return (across + down) / 2
}

// The box one key of a proportional dial fills, which moves as the cuts do. Module level, as
// every animated piece here is, so it is not remounted by the dial drawing again.
function CarvedSlot({
  index,
  dial,
  metrics,
  carve,
  sweep,
  children,
}: {
  index: number
  dial: DialSpec
  metrics: DialMetrics
  carve: SharedValue<number[]>
  // How far the drawing has been made: the keys come up in grey once the square is ruled and
  // cut. See `DRAW`.
  sweep: SharedValue<number>
  children: ReactNode
}) {
  const place = useAnimatedStyle(() => {
    const rect = cellRect(index, carve.value, metrics, dial)
    return {
      opacity: phaseOf(sweep.value, DRAW.keys),
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
    }
  })
  return (
    <Animated.View style={[{ position: 'absolute' }, place]}>{children}</Animated.View>
  )
}

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
  showSum,
  trainee,
  peakFrom,
  peakTo,
  corners = DEFAULT_DIAL_CORNERS,
  controls,
  liveKey = null,
  bigHints = false,
  axes = false,
  hand = null,
  drag = true,
  flame = null,
  hitSeq = 0,
  opened = true,
  sweep = null,
  onDelta,
  onSet,
  onSweep,
}: {
  // The dial being drawn: how many keys, how they are arranged, what each is worth and
  // how far a digit goes. Everything in here that used to be a nine or a three.
  dial: DialSpec
  // The digits, row-major.
  values: readonly number[]
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
  // The corner numbers, drawn larger. The lesson's own dial asks for it: those numbers are
  // the whole of what it has to teach, where in a practice run they are a reference beside
  // a game somebody is already playing.
  bigHints?: boolean
  // The row and column multipliers, printed outside the keys — see
  // components/game/dial-axes.tsx. The lesson turns them on once it has explained them.
  axes?: boolean
  // A gesture to mime over the keys, for as long as the lesson is asking for one.
  hand?: HandGesture | null
  // Whether one gesture may move more than one key. Off is two different answers, and
  // both are the caller's to give: the player's own setting, which is on by default and
  // turned off from Options, and the tutorial's — where the drag is the last move the
  // lesson teaches and so must not work before it has been taught. What is left when it
  // is off is every move on one key: a tap, the three swipes, and a finger that wanders
  // off a key and back onto it.
  drag?: boolean
  // How many strikes have set every key alight — the `flame` shot, see `DialFlames`. Null
  // for every mode whose shot is drawn over the board instead.
  flame?: number | null
  // A count that goes up on every press that takes a target — the run's `hitBatch.seq`,
  // which is a press count rather than a target count and is not reset between runs. Read
  // only on a dial that **scrambles** (see lib/scramble.ts), where every such press is a
  // scramble: each key flips its new digit in, and a gesture it lands in is over. Left at
  // nought by every caller whose dial holds still.
  hitSeq?: number
  // Whether the run's **opening** has reached its switch. False only while one is still
  // playing with the lights on; true for every run without one. A dial that is blacked
  // out (`DialSpec.blackout`) shows its digits until then, so the scene can take them away.
  opened?: boolean
  // How far an opening's edge has swept the screen, for a **mirrored** dial's keys to turn
  // over as it reaches them. Null for every caller with no such scene: they stand turned.
  sweep?: SharedValue<number> | null
  // `sweep` is whether this change is part of a drag — see `DialCommand`.
  onDelta: (index: number, delta: 1 | -1, sweep: boolean) => void
  onSet: (index: number, value: number, sweep: boolean) => void
  // Said once, the moment one gesture moves a second key — the one thing a run of separate
  // swipes cannot do, and so the only way to know a drag was a drag. Every key it moves
  // still reports itself through `onDelta` / `onSet`; this says they came together. The
  // tutorial's last lesson is the only thing listening.
  onSweep?: () => void
}) {
  const laid = useDialMetrics(dial)
  // A proportional dial has no space between its keys: they are the parts of one square,
  // and the lines between them are drawn, not left as a gap.
  //
  // A **flush** dial has none either, and spends it on the keys: each is as wide as a key and a
  // gap were, so the dial takes the room it did and its keys are the tiles of a grid.
  const flushed = {
    button: laid.button + laid.gap,
    gap: 0,
    width: (laid.button + laid.gap) * dial.cols,
    height: (laid.button + laid.gap) * dial.rows,
  }
  const metrics = dial.proportional ? { ...laid, gap: 0 } : dial.flush ? flushed : laid
  // Where the keys stand on the window, told to the tiles round them. See `useTileGrid`.
  const keysBox = useRef<View>(null)
  const viewport = useViewport()
  const burn = useBurn(flame)
  const live = controls ?? allLive(dial)

  // A **proportional** dial's cuts, as the pan and the keys both read them: where the rows
  // and columns divide the square at this moment, following the digits to their next
  // position. Held on a dial that is not proportional too, since a hook cannot be skipped;
  // it is just never read there.
  const carved = dial.proportional
  const carve = useSharedValue(carveOf(dial, values))
  // The drawing is whole unless an opening is making it.
  const made = useSharedValue(1)
  const drawn = sweep ?? made

  // The cuts follow the digits as they are drawn, which is a beat after the finger — the
  // keys' own tint and the sum above them turn over on the same beat.
  useEffect(() => {
    if (!carved) return
    carve.value = withTiming(carveOf(dial, values), CARVE_TIMING)
  }, [values, carved])

  const { gesture, commands, pressed, inFlight } = useDialPan({
    dial,
    values,
    metrics,
    carved,
    carve,
    live,
    drag,
    hitSeq,
    onSweep,
  })

  return (
    // The margin is the dial's own, not the screen's: the keys sit at the bottom of every
    // screen that draws them, and the room under the last row is part of the dial being
    // comfortable to swipe on rather than a decision the game, the room and the arcade
    // each make for themselves.
    <View className="mb-6 items-center">
      {/* The keys' own box, so the two things the lesson draws outside them — the
        multipliers above and to the left, the thumb miming a gesture over them — are
        placed against the dial rather than against the screen. Absolute, every one of
        them: a label about the dial must never be a reason the dial moves.

        Not clipped, said out loud: the labels above and to the left are the first things
        in the app drawn properly outside this box — the key halos only ever reach a few
        points past it — and a box that clipped them would simply eat them. */}
      <View
        ref={keysBox}
        style={{ width: metrics.width, height: metrics.height, overflow: 'visible' }}
        onLayout={() => {
          if (!dial.flush) return
          keysBox.current?.measureInWindow((x, y) => {
            reportTileGrid({ x, y, size: metrics.button })
          })
        }}
      >
        {/* First, so every key is drawn over every flame. */}
        {flame !== null && (
          <DialFlames
            dial={dial}
            metrics={metrics}
            burn={burn}
            carve={carved ? carve : null}
          />
        )}
        <GestureDetector gesture={gesture}>
          <View
            style={{ width: metrics.width, height: metrics.height, gap: metrics.gap }}
            className="flex-row flex-wrap"
          >
            {cellsOf(dial).map((index) => {
              // The keys come in as a wave down the diagonals, on the game screen's
              // entrance — see components/game/arrival.tsx.
              const arriving = (
                <Arrival
                  order={DIAL_ORDER + Math.floor(index / dial.cols) + (index % dial.cols)}
                  from="below"
                  style={carved ? FILL : undefined}
                >
                  <DialButton
                    index={index}
                    value={values[index] ?? 0}
                    size={metrics.button}
                    weight={weightAt(dial, index)}
                    digits={dial.digits}
                    orientation={dial.orientation}
                    showSum={showSum}
                    digitSize={cellsOf(dial).length === 1 ? SOLE_DIGIT : undefined}
                    trainee={trainee}
                    bigHints={bigHints}
                    corners={corners}
                    control={live[index] ?? 'full'}
                    hinted={liveKey === index}
                    heat={flame === null ? null : burn.heat}
                    scrambles={dial.scramble ? hitSeq : 0}
                    dark={dial.blackout && opened}
                    mirrored={dial.mirror}
                    sketched={carved}
                    sweep={sweep}
                    sweepAt={sweepPlaceOf(index, dial, metrics, viewport)}
                    peakFrom={peakFrom}
                    peakTo={peakTo}
                    commands={commands}
                    pressed={pressed}
                    inFlight={inFlight}
                    onDelta={(delta, sweep) => {
                      onDelta(index, delta, sweep)
                    }}
                    onSet={(value, sweep) => {
                      onSet(index, value, sweep)
                    }}
                  />
                </Arrival>
              )
              // A proportional dial puts each key in the box its share of the square
              // gives it; every other dial lets the keys flow into a grid.
              return carved ? (
                <CarvedSlot
                  key={index}
                  index={index}
                  dial={dial}
                  metrics={metrics}
                  carve={carve}
                  sweep={drawn}
                >
                  {arriving}
                </CarvedSlot>
              ) : (
                <Fragment key={index}>{arriving}</Fragment>
              )
            })}
          </View>
        </GestureDetector>
        {carved && (
          <DialSketch
            dial={dial}
            metrics={metrics}
            carve={carve}
            values={values}
            sweep={drawn}
          />
        )}
        {axes && <DialAxes dial={dial} metrics={metrics} />}
        {hand !== null && <GestureHint gesture={hand} dial={dial} metrics={metrics} />}
      </View>
    </View>
  )
}
