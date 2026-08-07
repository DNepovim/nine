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

export function WeightsLesson({ isDark, onComplete, nextButton }: LessonProps) {
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
              {taps === 0 && finished !== undefined
                ? `${WEIGHTS_TAPS} × ${cellWeight(finished.cell)} = ${roundTotal(finished.cell)}`
                : ''}
            </Text>
            {nextButton}
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
          hintCell={current?.cell ?? null}
          hintGesture="tap"
          hintColor={COLOR}
          // Only taps on the button being demonstrated count. The first tap of a
          // round wipes the previous one, so the finished total stays on screen
          // until the player moves on.
          onDelta={(index, delta) => {
            if (delta !== 1) return
            setState((state) => {
              if (index !== WEIGHT_ROUNDS[state.round]?.cell) return state
              const base = state.taps === 0 ? emptyCells() : state.cells
              const taps = state.taps + 1
              const done = taps === WEIGHTS_TAPS
              return {
                cells: dialCell(base, index, 1),
                round: done ? state.round + 1 : state.round,
                taps: done ? 0 : taps,
              }
            })
          }}
          onSet={() => {}}
        />
      </DialStage>
    </View>
  )
}
