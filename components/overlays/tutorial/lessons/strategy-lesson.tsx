import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { PieCountdown } from '@/components/game/pie-countdown'
import { DialStage } from '@/components/overlays/tutorial/dial-stage'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { LiveDialGrid } from '@/components/overlays/tutorial/live-dial-grid'
import { SumReadout } from '@/components/overlays/tutorial/sum-readout'
import { TaskPrompt } from '@/components/overlays/tutorial/task-prompt'
import {
  COARSE_CELL,
  FINE_CELL,
  MID_CELL,
  STEP_COLORS,
  STRATEGY_COARSE_VALUE,
  STRATEGY_RING_MS,
  STRATEGY_TARGET,
} from '@/constants/tutorial'
import { useGameDialSize } from '@/hooks/use-game-dial-size'
import { cellWeight, dialCell, emptyCells, setCell, sumCells } from '@/lib/tutorial-grid'
import type { LessonProps } from '@/types/tutorial'

const COLOR = STEP_COLORS[3] ?? '#E5534B'

const COARSE_REACH = STRATEGY_COARSE_VALUE * cellWeight(COARSE_CELL)
const MID_REACH = COARSE_REACH + cellWeight(MID_CELL)

// Heavy button first to cover the distance, then the two light ones to walk the
// last few points in. Each entry is "get this cell up to this value".
const ROUTE = [
  {
    cell: COARSE_CELL,
    upTo: STRATEGY_COARSE_VALUE,
    prompt: `Tap the ×9 button twice — that alone covers ${COARSE_REACH} of the ${STRATEGY_TARGET}.`,
  },
  {
    cell: MID_CELL,
    upTo: 1,
    prompt: `${COARSE_REACH}. One tap on a ×2 button takes it to ${MID_REACH}.`,
  },
  {
    cell: FINE_CELL,
    upTo: 1,
    prompt: `${MID_REACH} — one short. The ×1 button lands it exactly.`,
  },
] as const

export function StrategyLesson({ isDark, onComplete, nextButton }: LessonProps) {
  const [cells, setCells] = useState<readonly number[]>(emptyCells)
  // Bumping the key remounts the ring, which is how a fresh target is dealt.
  const [ringKey, setRingKey] = useState(0)
  const [ranOut, setRanOut] = useState(false)
  const dialSize = useGameDialSize()

  const sum = sumCells(cells)
  const hit = sum === STRATEGY_TARGET
  const stage = ROUTE.findIndex(({ cell, upTo }) => (cells[cell] ?? 0) < upTo)
  const step = stage === -1 ? undefined : ROUTE[stage]

  useEffect(() => {
    if (hit) onComplete()
  }, [hit, onComplete])

  const prompt = () => {
    if (hit) return `${STRATEGY_TARGET} exactly — that’s a hit.`
    if (sum > STRATEGY_TARGET)
      return `${sum} is over ${STRATEGY_TARGET}. Swipe a button left to clear it and come back down.`
    return step?.prompt ?? `Keep dialling — you want ${STRATEGY_TARGET} on the nose.`
  }

  // Point at the button the route needs next, and stop once the target is hit.
  const hintCell = () => {
    if (hit || sum > STRATEGY_TARGET) return null
    return step?.cell ?? null
  }

  return (
    <View className="flex-1">
      <LessonHeading title="COARSE, THEN FINE" color={COLOR}>
        {'Heavy buttons cover the distance. Light buttons land the exact number.'}
      </LessonHeading>

      <TaskPrompt text={prompt()} done={hit} color={COLOR} />

      <DialStage
        // The target sits in the targets area and the total above the dial —
        // both exactly where the game puts them.
        above={
          <View className="items-center">
            <PieCountdown
              key={ringKey}
              value={STRATEGY_TARGET}
              isDark={isDark}
              active={!hit}
              duration={STRATEGY_RING_MS}
              onComplete={() => {
                setRanOut(true)
                setRingKey((current) => current + 1)
              }}
            />
            <Text
              selectable={false}
              className="mt-2 text-center font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
            >
              {ranOut && !hit
                ? 'THE RING EMPTIED — FRESH TARGET, NO HARM DONE'
                : 'THE RING IS THE TARGET’S COUNTDOWN'}
            </Text>
            {nextButton}
          </View>
        }
        readout={<SumReadout sum={sum} isDark={isDark} />}
        dialSize={dialSize}
      >
        <LiveDialGrid
          cells={cells}
          isDark={isDark}
          size={dialSize}
          showWeights
          hintCell={hintCell()}
          hintGesture="tap"
          hintColor={COLOR}
          onDelta={(index, delta) => {
            setCells((current) => dialCell(current, index, delta))
          }}
          onSet={(index, value) => {
            setCells((current) => setCell(current, index, value))
          }}
        />
      </DialStage>
    </View>
  )
}
