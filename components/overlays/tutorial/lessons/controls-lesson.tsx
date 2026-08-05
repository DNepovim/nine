import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { DialButton } from '@/components/game/dial-button'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { SubStepDots } from '@/components/overlays/tutorial/sub-step-dots'
import { TaskPrompt } from '@/components/overlays/tutorial/task-prompt'
import { ThumbHint, type ThumbGesture } from '@/components/overlays/tutorial/thumb-hint'
import { CONTROLS_START_VALUE, STEP_COLORS } from '@/constants/tutorial'
import { useGameDialSize } from '@/hooks/use-game-dial-size'
import { dialValue, GRID_SIZE } from '@/lib/tutorial-grid'
import { DARK_MODE_GRADIENT } from '@/machines/modes'
import type { LessonProps } from '@/types/tutorial'

const COLOR = STEP_COLORS[1] ?? '#7273D2'

// The hit flash a key wears at 9 — Trainee's, the run this tutorial ends in.
const [PEAK_FROM, PEAK_TO] = DARK_MODE_GRADIENT.trainee

// Swipe up is deliberately absent — tap already covers +1, so it's one gesture
// fewer to learn for the same result. `arrivesAt` is the value a horizontal swipe
// lands on; the vertical ones are relative and have none.
const GESTURE_TASKS = [
  { gesture: 'tap', prompt: 'Tap the button — every tap adds 1.', arrivesAt: null },
  {
    gesture: 'down',
    prompt: 'Now swipe down — that takes 1 back off.',
    arrivesAt: null,
  },
  {
    gesture: 'right',
    prompt: 'Swipe right — straight to 9 in one move.',
    arrivesAt: 9,
  },
  { gesture: 'left', prompt: 'And swipe left — straight back to 0.', arrivesAt: 0 },
] as const satisfies readonly {
  gesture: ThumbGesture
  prompt: string
  arrivesAt: number | null
}[]

export function ControlsLesson({ isDark, onComplete }: LessonProps) {
  const [value, setValue] = useState(CONTROLS_START_VALUE)
  const [taskIndex, setTaskIndex] = useState(0)
  // Sized like the game's dial pad so the button is exactly the size — and in the
  // position — of the real dial's centre cell.
  const [measured, setMeasured] = useState(0)
  const size = useGameDialSize(measured)
  const task = GESTURE_TASKS[taskIndex]
  const cellSize = Math.floor(size / GRID_SIZE)

  useEffect(() => {
    if (task === undefined) onComplete()
  }, [task, onComplete])

  // DialButton skips its callback when a horizontal swipe wouldn't change
  // anything, so a button already sitting on the destination could never report
  // the gesture. Count it as done instead of dead-ending the step. Only reachable
  // by dialling through the 9 → 0 wrap first; the normal path never hits it.
  useEffect(() => {
    if (task?.arrivesAt === value) setTaskIndex((index) => index + 1)
  }, [task, value])

  // Only the gesture the current sub-step asks for advances it; the dial still
  // responds to everything else, it just doesn't count.
  const satisfy = (gesture: ThumbGesture) => {
    if (task?.gesture === gesture) setTaskIndex((index) => index + 1)
  }

  return (
    <View className="flex-1">
      <LessonHeading title="CONTROLS" color={COLOR}>
        {'Four moves, one button. It keeps whatever value you leave it on.'}
      </LessonHeading>

      <TaskPrompt
        text={task === undefined ? 'That’s every move the dial has.' : task.prompt}
        done={task === undefined}
        color={COLOR}
      />
      <SubStepDots total={GESTURE_TASKS.length} current={taskIndex} color={COLOR} />

      <View
        className="flex-1 items-center justify-end"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setMeasured(Math.min(width, height))
        }}
      >
        {/* The full dial's footprint, with only its centre cell filled. */}
        <View
          style={{ width: size, height: size }}
          className="items-center justify-center"
        >
          {cellSize > 0 && (
            <DialButton
              value={value}
              isDark={isDark}
              size={cellSize}
              weight={1}
              peakFrom={PEAK_FROM}
              peakTo={PEAK_TO}
              showSum={false}
              trainee={false}
              onDelta={(delta) => {
                setValue((current) => dialValue(current, delta))
                satisfy(delta === 1 ? 'tap' : 'down')
              }}
              onSet={(next) => {
                setValue(next)
                satisfy(next === 9 ? 'right' : 'left')
              }}
            />
          )}

          {task !== undefined && cellSize > 0 && (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center"
            >
              <ThumbHint
                gesture={task.gesture}
                color={COLOR}
                size={Math.round(cellSize * 0.8)}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
