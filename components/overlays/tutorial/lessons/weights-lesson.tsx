import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { DialStage } from '@/components/overlays/tutorial/dial-stage'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { LiveDialGrid } from '@/components/overlays/tutorial/live-dial-grid'
import { SubStepDots } from '@/components/overlays/tutorial/sub-step-dots'
import { SumReadout } from '@/components/overlays/tutorial/sum-readout'
import { TaskPrompt } from '@/components/overlays/tutorial/task-prompt'
import {
  COARSE_CELL,
  FINE_CELL,
  MID_CELL,
  STEP_COLORS,
  WEIGHTS_CLEAR_DELAY_MS,
  WEIGHTS_TAPS,
} from '@/constants/tutorial'
import { useGameDialSize } from '@/hooks/use-game-dial-size'
import { cellWeight, dialCell, emptyCells, sumCells } from '@/lib/tutorial-grid'
import type { LessonProps } from '@/types/tutorial'

const COLOR = STEP_COLORS[2] ?? '#c36282'

// The same three taps on three different buttons. Nothing changes but where they
// land, so the board total is doing all the talking.
const WEIGHT_ROUNDS = [
  { cell: FINE_CELL, lead: 'Start small.' },
  { cell: MID_CELL, lead: 'Board cleared. Same three taps, one column over.' },
  { cell: COARSE_CELL, lead: 'Cleared again. Now the far corner.' },
] as const

const roundTotal = (cell: number) => WEIGHTS_TAPS * cellWeight(cell)

// The multiplication the board is doing, on screen the whole time rather than only
// once a round lands — watching `1 × 9` become `2 × 9` is the point of the screen, and
// a line that appears and disappears also shifts everything under it.
//
// Between rounds the finished total stays up while the next prompt is being read: taps
// are back to 0 but the board still holds what the last round built. Only the very
// first round opens on `0 × 1 = 0`, which is the shape of the sum about to be filled in.
function equation(
  taps: number,
  current: { cell: number } | undefined,
  finished: { cell: number } | undefined,
): string {
  if (taps === 0 && finished !== undefined) {
    return `${WEIGHTS_TAPS} × ${cellWeight(finished.cell)} = ${roundTotal(finished.cell)}`
  }
  if (current === undefined) return ''
  return `${taps} × ${cellWeight(current.cell)} = ${taps * cellWeight(current.cell)}`
}

export function WeightsLesson({ isDark, onComplete }: LessonProps) {
  // Board, round and tap count move together: checking the target cell inside the
  // updater keeps two taps landing in the same frame from over-counting.
  const [{ cells, round, taps }, setState] = useState<{
    cells: readonly number[]
    round: number
    taps: number
  }>(() => ({ cells: emptyCells(), round: 0, taps: 0 }))
  const dialSize = useGameDialSize()
  const current = WEIGHT_ROUNDS[round]
  const finished = WEIGHT_ROUNDS[round - 1]

  useEffect(() => {
    if (current === undefined) onComplete()
  }, [current, onComplete])

  // A finished round holds its total for a beat, then the board clears and the next
  // round's prompt arrives together — that prompt opens by saying the board is cleared,
  // and it used to say so while the previous total was still sitting there, because the
  // wipe waited for the next round's first tap.
  //
  // The last round keeps its total: nothing follows it to clear for, and its closing
  // line is about the three numbers the screen just produced.
  useEffect(() => {
    if (taps !== WEIGHTS_TAPS) return
    const timer = setTimeout(() => {
      setState((state) => ({
        cells: WEIGHT_ROUNDS[state.round + 1] === undefined ? state.cells : emptyCells(),
        round: state.round + 1,
        taps: 0,
      }))
    }, WEIGHTS_CLEAR_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [taps])

  return (
    <View className="flex-1">
      <LessonHeading title="POSITION IS POWER" color={COLOR}>
        {'A button’s weight is its row × its column — the small print above it.'}
      </LessonHeading>

      <TaskPrompt
        text={
          current === undefined
            ? `Three taps, three totals: ${roundTotal(FINE_CELL)}, ${roundTotal(MID_CELL)}, ${roundTotal(COARSE_CELL)}.`
            : `${current.lead} Tap the ×${cellWeight(current.cell)} button ${WEIGHTS_TAPS} times.`
        }
        done={current === undefined}
        color={COLOR}
      />
      <SubStepDots total={WEIGHT_ROUNDS.length} current={round} color={COLOR} />

      <DialStage
        above={
          <View className="items-center">
            <Text
              selectable={false}
              className="px-6 text-center font-mono text-[11px] font-bold leading-[16px] tracking-[0.5px] text-dim"
            >
              {equation(taps, current, finished)}
            </Text>
          </View>
        }
        readout={<SumReadout sum={sumCells(cells)} isDark={isDark} />}
        dialSize={dialSize}
      >
        <LiveDialGrid
          cells={cells}
          isDark={isDark}
          size={dialSize}
          showWeights
          showMax={false}
          // The hint stops once the round is satisfied — it has nothing left to ask for
          // while the total is being held.
          hintCell={taps === WEIGHTS_TAPS ? null : (current?.cell ?? null)}
          hintGesture="tap"
          hintColor={COLOR}
          // Only taps on the button being demonstrated count. Reaching the third tap
          // does not advance the round — it parks there, and the effect above is what
          // clears the board and moves on a beat later.
          onDelta={(index, delta) => {
            if (delta !== 1) return
            setState((state) => {
              // A fourth tap would land on a board that is about to be wiped.
              if (state.taps === WEIGHTS_TAPS) return state
              if (index !== WEIGHT_ROUNDS[state.round]?.cell) return state
              return {
                cells: dialCell(state.cells, index, 1),
                round: state.round,
                taps: state.taps + 1,
              }
            })
          }}
          onSet={() => {}}
        />
      </DialStage>
    </View>
  )
}
