import { useEffect, useState } from 'react'
import { Text } from 'react-native'

import { READOUT } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { formatRunClock } from '@/lib/duration'

// How often the figure is redrawn.
//
// Not every frame, and not once a second. Three decimal places moving at 60Hz is a blur
// nobody reads — the eye cannot follow a thousandths digit at all — while a clock
// stepping once a second is not a stopwatch. Twenty a second is twice the rate the
// tenths digit moves at, so it never lags a step behind the wall clock.
//
// The *value* is exact either way: it is read off the wall clock each tick rather than
// counted up, so the figure is right to the millisecond whenever it is drawn, and a
// dropped frame costs nothing.
const TICK_MS = 50

// The run clock, running, in the slot a scored run keeps its average accuracy in.
//
// Its own component for one reason: it redraws twenty times a second and the game screen
// must not. Everything it needs is a prop, and the ticking state lives in here, so a
// screen holding a dial, a board and nine targets re-renders exactly as often as it did
// before this existed.
//
// It is also why the two numbers are passed rather than the elapsed total: `playingSince`
// is set once when play begins and `elapsedMs` only moves when it stops, so both props
// are stable for the whole of a run and this component is the only thing changing.
export function RunStopwatch({
  elapsedMs,
  playingSince,
  digitFont,
}: {
  // What the run has already banked — every stretch before this one, folded shut by the
  // machine each time `playing` was left.
  elapsedMs: number
  // When the stretch being played now began, or null whenever the run is not being
  // played. Null freezes the figure, which is what a pause should do to a stopwatch.
  playingSince: number | null
  // The seven-segment face, or `mono` until it loads — resolved by the screen, which
  // is where it is loaded and where the score beside this one already reads it from.
  digitFont: string
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (playingSince === null) return
    const timer = setInterval(() => {
      setNow(Date.now())
    }, TICK_MS)
    return () => {
      clearInterval(timer)
    }
  }, [playingSince])

  const running = playingSince === null ? elapsedMs : elapsedMs + (now - playingSince)

  return (
    <Text
      selectable={false}
      // The same role, face and ink as the score cluster at the other end of this row.
      // They are a matched pair: on a race the clock *is* what the run is worth, so it
      // should look like the figure it has replaced rather than like a label.
      //
      // Which is also why the clock is drawn with a colon rather than the prime marks
      // the rest of the app's durations wear — DSEG7 has digits, a point and a colon
      // and nothing else. See `formatRunClock`, and `formatCountdown` beside it, where
      // the colon is already this app's mark for a figure that is a clock.
      className={cn(READOUT.best, 'text-score')}
      style={{ fontFamily: digitFont }}
    >
      {formatRunClock(running)}
    </Text>
  )
}
