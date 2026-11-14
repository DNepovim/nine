import { View } from 'react-native'

import { Dial } from '@/components/game/dial'
import { DEFAULT_DIAL_CORNERS } from '@/constants/dial-hints'
import type { ScreenField } from '@/hooks/use-play-field'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenControl } from '@/hooks/use-run-control'
import { SchemeProvider } from '@/hooks/use-scheme'
import { darkGradientOf } from '@/modes'

// The dial a run is played on, in the scheme the dial wears, sized by the width.
export function RunDial({
  control,
  announcements,
  field,
}: {
  control: ScreenControl
  announcements: ScreenAnnouncements
  field: ScreenField
}) {
  const {
    corners,
    dial,
    drag,
    grid,
    hitBatch,
    mode,
    opening,
    rules,
    showSum,
    state,
    tutorial,
  } = control
  const { coach, sendDialed, setSweptIn } = announcements
  const { dialControls, flame, lesson, shuffles } = field
  return (
    <>
      {/* ── Dial pad ── */}
      {/* Its own content's height, not a share of what is left. Splitting the
    remainder with the targets area is what cropped the bottom row on a short
    screen: the dial's size comes from the width now, so half the leftover
    height is not a number it can be asked to fit inside. The targets area
    above takes the slack instead. */}
      <View>
        <SchemeProvider kind={opening.dialScheme}>
          <Dial
            dial={dial}
            values={grid.flat()}
            opened={opening.opened}
            sweep={opening.sweep}
            showSum={showSum && !tutorial}
            trainee={rules.capabilities.keyHints}
            // The tutorial prints the weight and nothing else, whatever the player
            // has since chosen for practice: it is the one number a key cannot be
            // worked out without, and every other corner is a lesson that has not
            // been given yet.
            corners={tutorial ? DEFAULT_DIAL_CORNERS : corners}
            // What each key will take, and which one is being asked for. `full`
            // everywhere in every run but a guided tutorial route.
            controls={dialControls}
            liveKey={lesson.liveKey}
            // The lesson's own dial: its corner numbers drawn large, because in a
            // lesson they are the thing being taught rather than a reference beside a
            // game; the row and column multipliers up once the lesson has explained
            // them; and whichever gesture it is currently asking for, mimed over the
            // keys until the player makes it.
            bigHints={tutorial}
            axes={lesson.axes}
            hand={lesson.hand}
            // Both halves of the answer: the player's own setting, and the lesson's
            // — which takes the drag away until it has taught it, and says yes in
            // every run that is not a live tutorial.
            drag={drag && lesson.drag}
            flame={flame}
            // On a dial that scrambles, every hit is a scramble — see `Dial`.
            hitSeq={hitBatch.seq + shuffles}
            peakFrom={darkGradientOf(mode)[0]}
            peakTo={darkGradientOf(mode)[1]}
            onDelta={(index, delta, sweep) => {
              coach.notePress(index, delta)
              lesson.notePress(delta)
              sendDialed({ type: 'PRESS', index, delta, now: Date.now() }, sweep)
            }}
            onSet={(index, cellValue, sweep) => {
              coach.noteSet(index, cellValue)
              lesson.noteSet(cellValue)
              sendDialed(
                {
                  type: 'SET_CELL',
                  index,
                  value: cellValue,
                  now: Date.now(),
                },
                sweep,
              )
            }}
            onSweep={() => {
              lesson.noteSweep()
              setSweptIn((held) => ({
                ...held,
                gesture: state.context.runSeq,
              }))
            }}
          />
        </SchemeProvider>
      </View>
    </>
  )
}
