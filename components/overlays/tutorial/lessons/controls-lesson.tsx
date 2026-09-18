import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { DialButton } from '@/components/game/dial-button'
import { DialStage } from '@/components/overlays/tutorial/dial-stage'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { SubStepDots } from '@/components/overlays/tutorial/sub-step-dots'
import { TaskPrompt } from '@/components/overlays/tutorial/task-prompt'
import { ThumbHint, type ThumbGesture } from '@/components/overlays/tutorial/thumb-hint'
import {
  CONTROLS_START_VALUE,
  STEP_ACCENT_COLORS,
  STEP_COLORS,
} from '@/constants/tutorial'
import { useGameDialSize } from '@/hooks/use-game-dial-size'
import { dialValue, GRID_SIZE } from '@/lib/tutorial-grid'
import { DARK_MODE_GRADIENT } from '@/machines/modes'
import type { LessonProps } from '@/types/tutorial'

// The heading and callout speak in one colour; the thumb over the button — the
// thing to actually copy — speaks in the other, so the eye can tell "read" from
// "do" without reading either.
const COLOR = STEP_COLORS[1] ?? '#7273D2'
const ACCENT = STEP_ACCENT_COLORS[1] ?? '#9c73c9'

// The hit flash a key wears at 9 — Trainee's, the run this tutorial ends in.
const [PEAK_FROM, PEAK_TO] = DARK_MODE_GRADIENT.trainee

// Both horizontal swipes are taught, and next to each other. The pair is the point —
// knowing a swipe jumps to the far edge is only half of it if you cannot say which edge,
// and a player who has practised only one reaches for a tap when they want the other.
//
// Swipe up stays absent: tap already covers +1, so it is one gesture fewer to learn for
// the same result.
//
// The gesture is named on its own so the callout can set it apart from the reason: the
// arrow, the words and the thumb over the button then all say the same direction.
const GESTURE_TASKS = [
  { gesture: 'tap', action: msg`TAP`, detail: msg`every tap adds 1.` },
  { gesture: 'down', action: msg`SWIPE DOWN`, detail: msg`that takes 1 back off.` },
  { gesture: 'right', action: msg`SWIPE RIGHT`, detail: msg`straight to 9 in one move.` },
  { gesture: 'left', action: msg`SWIPE LEFT`, detail: msg`and straight back to 0.` },
] as const satisfies readonly {
  gesture: ThumbGesture
  action: MessageDescriptor
  detail: MessageDescriptor
}[]

const ALL_DONE = msg`That’s every move the dial has.`

export function ControlsLesson({ isDark, onComplete }: LessonProps) {
  // Value and sub-step move as one: checking the gesture inside the updater keeps
  // two gestures landing in the same frame from advancing twice off a stale read.
  const [{ value, taskIndex }, setState] = useState(() => ({
    value: CONTROLS_START_VALUE,
    taskIndex: 0,
  }))
  const { t } = useLingui()
  const dialSize = useGameDialSize()
  const cellSize = Math.floor(dialSize / GRID_SIZE)
  const task = GESTURE_TASKS[taskIndex]

  useEffect(() => {
    if (task === undefined) onComplete()
  }, [task, onComplete])

  // Only the gesture the current sub-step asks for does anything at all — and
  // because performing it moves the sub-step on, each one works exactly once.
  // Everything else leaves the button untouched, so the taught order holds and
  // the value walks a fixed path: 5 → 6 → 5 → 9 → 0.
  const attempt = (gesture: ThumbGesture, next: (current: number) => number) => {
    setState((current) => {
      if (GESTURE_TASKS[current.taskIndex]?.gesture !== gesture) return current
      return { value: next(current.value), taskIndex: current.taskIndex + 1 }
    })
  }

  return (
    <View className="flex-1">
      <LessonHeading title={<Trans>CONTROLS</Trans>} color={COLOR}>
        <Trans>Three moves, one button. Try them in order.</Trans>
      </LessonHeading>

      <TaskPrompt
        text={t(task === undefined ? ALL_DONE : task.detail)}
        action={task === undefined ? undefined : t(task.action)}
        gesture={task?.gesture}
        done={task === undefined}
        color={COLOR}
      />
      <SubStepDots total={GESTURE_TASKS.length} current={taskIndex} color={COLOR} />

      <DialStage above={null} readout={null} dialSize={dialSize}>
        {/* The dial's footprint, with only its centre cell filled. */}
        <View
          style={{ width: dialSize, height: dialSize }}
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
                attempt(delta === 1 ? 'tap' : 'down', (current) =>
                  dialValue(current, delta),
                )
              }}
              onSet={(next) => {
                attempt(next === 9 ? 'right' : 'left', () => next)
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
                color={ACCENT}
                size={Math.round(cellSize * 0.7)}
              />
            </View>
          )}
        </View>
      </DialStage>
    </View>
  )
}
