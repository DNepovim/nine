import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { PieCountdown } from '@/components/game/pie-countdown'
import { DialStage } from '@/components/overlays/tutorial/dial-stage'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { LiveDialGrid } from '@/components/overlays/tutorial/live-dial-grid'
import { SumReadout } from '@/components/overlays/tutorial/sum-readout'
import { TaskPrompt } from '@/components/overlays/tutorial/task-prompt'
import type { ThumbGesture } from '@/components/overlays/tutorial/thumb-hint'
import {
  FINE_CELL,
  LESSON_HEADER_SHRINK,
  MID_CELL,
  STEP_ACCENT_COLORS,
  STEP_COLORS,
  SWIPE_RING_MS,
  SWIPE_TARGET,
} from '@/constants/tutorial'
import { useGameDialSize } from '@/hooks/use-game-dial-size'
import { cellWeight, emptyCells, setCell, sumCells } from '@/lib/tutorial-grid'
import type { LessonProps } from '@/types/tutorial'

// The heading and callout speak in one colour; the dial hint pointing at the button
// to swipe next speaks in the other.
const COLOR = STEP_COLORS[4] ?? '#ee7440'
const ACCENT = STEP_ACCENT_COLORS[4] ?? '#f7a531'

const FIRST_REACH = cellWeight(FINE_CELL) * 9
const OVERSHOOT = FIRST_REACH + cellWeight(MID_CELL) * 9

// Two swipes right, deliberately past the target, then one swipe left to clear the
// overshoot — cheaper than nine taps in either direction would have been. The numbers
// are chosen to land the sequence exactly on SWIPE_TARGET: 9, then 27, then back to 18.
const ROUTE_TASKS = [
  {
    cell: FINE_CELL,
    gesture: 'right',
    action: 'SWIPE RIGHT',
    detail: 'the 1× button jumps straight to 9 — no tapping nine times.',
  },
  {
    cell: MID_CELL,
    gesture: 'right',
    action: 'SWIPE RIGHT',
    detail: `${FIRST_REACH}. Same move on the 2× button — straight to 9 again, that’s ${OVERSHOOT}.`,
  },
  {
    cell: FINE_CELL,
    gesture: 'left',
    action: 'SWIPE LEFT',
    detail: `${OVERSHOOT} is over ${SWIPE_TARGET}. Clear the 1× button and land it exactly.`,
  },
] as const satisfies readonly {
  cell: number
  gesture: ThumbGesture
  action: string
  detail: string
}[]

export function SwipeLesson({ isDark, onComplete }: LessonProps) {
  // Board and task move together: checking the task inside the updater keeps two
  // gestures landing in the same frame from advancing twice off a stale read.
  const [{ cells, taskIndex }, setState] = useState<{
    cells: readonly number[]
    taskIndex: number
  }>(() => ({ cells: emptyCells(), taskIndex: 0 }))
  const [ringKey, setRingKey] = useState(0)
  const [ranOut, setRanOut] = useState(false)
  const dialSize = useGameDialSize(LESSON_HEADER_SHRINK)
  const task = ROUTE_TASKS[taskIndex]

  useEffect(() => {
    if (task === undefined) onComplete()
  }, [task, onComplete])

  // Only the gesture the current task names, on the cell it names, does anything —
  // a stray tap or a swipe on the wrong button leaves the board untouched.
  const attempt = (index: number, gesture: ThumbGesture, next: number) => {
    setState((current) => {
      const currentTask = ROUTE_TASKS[current.taskIndex]
      if (currentTask === undefined) return current
      if (currentTask.cell !== index || currentTask.gesture !== gesture) return current
      return {
        cells: setCell(current.cells, index, next),
        taskIndex: current.taskIndex + 1,
      }
    })
  }

  return (
    <View className="flex-1">
      <LessonHeading title="SWIPE SHORTCUTS" color={COLOR}>
        {
          'A horizontal swipe jumps a button straight to 9 or 0 — coarse ground covered, or an overshoot cleared, in one move.'
        }
      </LessonHeading>

      <TaskPrompt
        text={
          task === undefined
            ? `${SWIPE_TARGET} exactly — two swipes out, one swipe back.`
            : task.detail
        }
        action={task?.action}
        gesture={task?.gesture}
        done={task === undefined}
        color={COLOR}
      />

      <DialStage
        above={
          <View className="items-center">
            <PieCountdown
              key={ringKey}
              value={SWIPE_TARGET}
              isDark={isDark}
              active={task !== undefined}
              duration={SWIPE_RING_MS}
              onComplete={() => {
                setRanOut(true)
                setRingKey((current) => current + 1)
              }}
            />
            <Text
              selectable={false}
              className="mt-2 text-center font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
            >
              {ranOut && task !== undefined
                ? 'THE RING EMPTIED — FRESH TARGET, NO HARM DONE'
                : 'THE RING IS THE TARGET’S COUNTDOWN'}
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
          hintCell={task?.cell ?? null}
          hintGesture={task?.gesture ?? 'tap'}
          hintColor={ACCENT}
          onDelta={() => {}}
          onSet={(index, value) => {
            attempt(index, value === 9 ? 'right' : 'left', value)
          }}
        />
      </DialStage>
    </View>
  )
}
