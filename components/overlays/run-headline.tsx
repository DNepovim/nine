import { Text } from 'react-native'

import type { RunScore } from '@/components/overlays/run-screen'
import { READOUT } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { formatRunClock } from '@/lib/duration'
import { measureOf, scoreInkOf, type Measure, type ModeId } from '@/modes'

// The run's score, under a headline that is not it.
//
// A timed run puts its clock in the readout, because the clock is what the standings
// place it on. The score still happened — it is what the fortune counts, and it is the
// second thing anybody wants to know about the run — so it stands under the clock
// rather than disappearing.
//
// **The same seven-segment face as the figure above it**, at the size the top bar gives
// its best scores. Both figures on this screen are readouts and should look it; what
// says which one the screen is about is the size and the ink, not the lettering. Set in
// the dim ink rather than the mode's, which is the whole of the hierarchy: the clock is
// coloured and large, the score is quiet and small.
function RunScoreUnder({ score }: { score: number }) {
  return (
    <Text
      selectable={false}
      className={cn(READOUT.best, 'text-dim')}
      style={{ fontFamily: 'DSEG7' }}
    >
      {score}
    </Text>
  )
}

// What a run measured by something other than its score leads with.
const LEAD = {
  time: ({ gameTimeMs }) => formatRunClock(gameTimeMs),
  hits: ({ hits }) => hits,
} as const satisfies Record<
  Exclude<Measure, 'score'>,
  (run: { hits: number; gameTimeMs: number }) => number | string
>

// What a run screen leads with, and what it puts under that.
//
// One answer for both screens that stop a run — the pause and the game over — because
// they must not disagree: a player who pauses on their clock and then finishes on their
// score would be looking at two different runs.
//
// **A timed run leads with its clock.** That is the figure its standings place it on, so
// it is the figure the screen is about; the score goes under, because it still happened
// and is still what the fortune counts. Every other run leads with its score, which is
// the only figure it has, and puts nothing under it.
//
// **A hits run leads with its hits**, for the same reason: NO SLIP is placed on how many
// targets the run took, the slip included, and the score goes under it as it does under
// a clock.
//
// Here beside the component rather than in `lib/`: it returns a node, so it is not the
// pure kind of helper `lib/` holds, and it is the props of the thing in this file.
export function runHeadline({
  mode,
  score,
  hits,
  gameTimeMs,
  glow,
}: {
  mode: ModeId
  score: number
  hits: number
  gameTimeMs: number
  glow?: string
}): RunScore {
  const color = scoreInkOf(mode)
  const measure = measureOf(mode)
  if (measure === 'score') return { value: score, color, glow }
  return {
    value: LEAD[measure]({ hits, gameTimeMs }),
    color,
    glow,
    under: <RunScoreUnder score={score} />,
  }
}
