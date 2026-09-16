import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { DialStage } from '@/components/overlays/tutorial/dial-stage'
import { FactorBox } from '@/components/overlays/tutorial/factor-box'
import { LessonHeading } from '@/components/overlays/tutorial/lesson-heading'
import { LiveDialGrid } from '@/components/overlays/tutorial/live-dial-grid'
import { SubStepDots } from '@/components/overlays/tutorial/sub-step-dots'
import { SumReadout } from '@/components/overlays/tutorial/sum-readout'
import { TaskPrompt } from '@/components/overlays/tutorial/task-prompt'
import {
  COARSE_CELL,
  FINE_CELL,
  LESSON_HEADER_SHRINK,
  MID_CELL,
  STEP_ACCENT_COLORS,
  STEP_COLORS,
  WEIGHTS_CLEAR_DELAY_MS,
  WEIGHTS_TAPS,
} from '@/constants/tutorial'
import { useGameDialSize } from '@/hooks/use-game-dial-size'
import { cn } from '@/lib/cn'
import {
  cellCol,
  cellRow,
  cellWeight,
  dialCell,
  emptyCells,
  GRID_SIZE,
  sumCells,
} from '@/lib/tutorial-grid'
import type { LessonProps } from '@/types/tutorial'

// The heading and callout speak in one colour; the running equation and the dial
// hint — the two things actually changing as the board fills — speak in the other.
const COLOR = STEP_COLORS[2] ?? '#c36282'
const ACCENT = STEP_ACCENT_COLORS[2] ?? '#ac5570'

// The row-order column hanging off the grid's left edge, in the margin the
// centred dial already has, rather than resizing that box and shifting the dial
// to make room.
const ROW_LABEL_WIDTH = 20

// The column-order row sits inside the grid's own top edge instead — DialButton
// leaves its own 10px of padding above each circle for its shadow, and that gutter
// is where this lands. Above the grid, in the gap the sum readout's band leaves
// before it, was the first attempt: that gap is only a few px on most screens, no
// room for a legible number, and the two collided.
const COL_LABEL_TOP = 1
const COL_LABEL_HEIGHT = 12

// The same three taps on three different buttons. Nothing changes but where they
// land, so the board total is doing all the talking.
const WEIGHT_ROUNDS = [
  { cell: FINE_CELL, lead: 'Start small.' },
  { cell: MID_CELL, lead: 'Board cleared. Same three taps, one column over.' },
  { cell: COARSE_CELL, lead: 'Cleared again. Now the far corner.' },
] as const

const roundTotal = (cell: number) => WEIGHTS_TAPS * cellWeight(cell)

// The three numbers the equation is multiplying, on screen the whole time rather
// than only once a round lands — watching `1 × 1 × 0` become `1 × 1 × 3` is the
// point of the screen, and boxes that appear and disappear also shift everything
// under them.
//
// No result box: the total already lives one glance down, in the sum readout the
// board itself keeps — showing it twice was two sources of truth for one number.
// The rotated `=` in its place still says "this is what that adds up to", just by
// pointing at the readout instead of repeating it.
//
// Between rounds the finished total stays up while the next prompt is being read:
// taps are back to 0 but the board still holds what the last round built.
function equationParts(
  taps: number,
  current: { cell: number } | undefined,
  finished: { cell: number } | undefined,
): { row: number; col: number; value: number } | null {
  if (taps === 0 && finished !== undefined) {
    const { cell } = finished
    return { row: cellRow(cell), col: cellCol(cell), value: WEIGHTS_TAPS }
  }
  if (current === undefined) return null
  const { cell } = current
  return { row: cellRow(cell), col: cellCol(cell), value: taps }
}

export function WeightsLesson({ isDark, onComplete }: LessonProps) {
  // Board, round and tap count move together: checking the target cell inside the
  // updater keeps two taps landing in the same frame from over-counting.
  const [{ cells, round, taps }, setState] = useState<{
    cells: readonly number[]
    round: number
    taps: number
  }>(() => ({ cells: emptyCells(), round: 0, taps: 0 }))
  const dialSize = useGameDialSize(LESSON_HEADER_SHRINK)
  const cellSize = Math.floor(dialSize / GRID_SIZE)
  const current = WEIGHT_ROUNDS[round]
  const finished = WEIGHT_ROUNDS[round - 1]
  const parts = equationParts(taps, current, finished)

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
            : `${current.lead} Tap the ${cellWeight(current.cell)}× button ${WEIGHTS_TAPS} times.`
        }
        done={current === undefined}
        color={COLOR}
      />
      <SubStepDots total={WEIGHT_ROUNDS.length} current={round} color={COLOR} />

      <DialStage
        above={
          parts !== null && (
            <View className="items-center">
              <View className="flex-row items-end gap-2">
                <View className="items-center">
                  <FactorBox value={parts.row} color={ACCENT} />
                  <Text
                    selectable={false}
                    className="mt-1 font-mono text-[9px] font-bold tracking-[1px] text-dim"
                  >
                    ROW
                  </Text>
                </View>
                <Text
                  selectable={false}
                  className="mb-5 font-mono text-[18px] font-black"
                  style={{ color: ACCENT }}
                >
                  ×
                </Text>
                <View className="items-center">
                  <FactorBox value={parts.col} color={ACCENT} />
                  <Text
                    selectable={false}
                    className="mt-1 font-mono text-[9px] font-bold tracking-[1px] text-dim"
                  >
                    COLUMN
                  </Text>
                </View>
                <Text
                  selectable={false}
                  className="mb-5 font-mono text-[18px] font-black"
                  style={{ color: ACCENT }}
                >
                  ×
                </Text>
                <View className="items-center">
                  <FactorBox value={parts.value} color={ACCENT} />
                  <Text
                    selectable={false}
                    className="mt-1 font-mono text-[9px] font-bold tracking-[1px] text-dim"
                  >
                    VALUE
                  </Text>
                </View>
              </View>
              {/* Rotated rather than a result box of its own — it points down at
                  the sum readout, which is already carrying this number. */}
              <Text
                selectable={false}
                className="mt-3 font-mono text-[20px] font-black"
                style={{ color: ACCENT, transform: [{ rotate: '90deg' }] }}
              >
                =
              </Text>
            </View>
          )
        }
        readout={<SumReadout sum={sumCells(cells)} isDark={isDark} />}
        dialSize={dialSize}
      >
        {/* Sized to exactly dialSize×dialSize, unchanged from before — the row and
            column labels are absolutely positioned outside that box, in the margin
            the centred dial already has, rather than resizing the box and shifting
            the dial itself off its usual position. */}
        <View style={{ width: dialSize, height: dialSize }}>
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
            hintColor={ACCENT}
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
          {/* Column order, directly on the grid's own top edge — the equation's
              "column" box and this row name the same number. */}
          <View
            pointerEvents="none"
            className="absolute flex-row"
            style={{
              top: COL_LABEL_TOP,
              left: 0,
              width: dialSize,
              height: COL_LABEL_HEIGHT,
            }}
          >
            {Array.from({ length: GRID_SIZE }, (_, c) => (
              <View key={c} className="items-center" style={{ width: cellSize }}>
                <Text
                  selectable={false}
                  className={cn(
                    'font-mono text-[12px] font-black tracking-[1px]',
                    parts?.col !== c + 1 && 'text-dim',
                  )}
                  style={[
                    { lineHeight: COL_LABEL_HEIGHT },
                    parts?.col === c + 1 ? { color: ACCENT } : undefined,
                  ]}
                >
                  {c + 1}
                </Text>
              </View>
            ))}
          </View>
          {Array.from({ length: GRID_SIZE }, (_, r) => (
            <View
              key={r}
              pointerEvents="none"
              className="absolute items-center justify-center"
              style={{
                left: -ROW_LABEL_WIDTH,
                top: r * cellSize,
                width: ROW_LABEL_WIDTH,
                height: cellSize,
              }}
            >
              <Text
                selectable={false}
                className={cn(
                  'font-mono text-[15px] font-black tracking-[1px]',
                  parts?.row !== r + 1 && 'text-dim',
                )}
                style={parts?.row === r + 1 ? { color: ACCENT } : undefined}
              >
                {r + 1}
              </Text>
            </View>
          ))}
        </View>
      </DialStage>
    </View>
  )
}
