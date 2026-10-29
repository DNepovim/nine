import { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Dial } from '@/components/game/dial'
import { HitSync } from '@/components/game/hit-sync'
import { PieCountdown } from '@/components/game/pie-countdown'
import { ScoreDigit } from '@/components/game/score-digit'
import { StrikeShot } from '@/components/game/strike-shot'
import { PIE_SIZE } from '@/constants/game'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { useStrikeShots, type ShotAim } from '@/hooks/use-strike-shots'
import { valueProgress } from '@/lib/value-progress'
import type { HitBatch, HitInfo } from '@/machines/game'
import {
  cellsOf,
  darkGradientOf,
  dialOf,
  modeById,
  NINE_DIAL,
  type Grid,
  type ModeId,
} from '@/modes'
import type { Position } from '@/types/game'

// Two values, and where each sits on the board. A strike needs a live multiplier, which
// in a real run means a chain of exact or fast presses — so this stage deals the press
// instead, and the effect can be watched as many times as it takes to judge 200ms.
const SHOWN = [
  { value: 147, at: { x: 120, y: 40 } },
  { value: 96, at: { x: 16, y: 150 } },
] as const satisfies readonly { value: number; at: Position }[]

const BLANK_GRID: Grid = [0, 0, 0, 0, 0, 0, 0, 0, 0]

// One hit of a press, as the machine would report it. Only `value` and `bonus` decide
// what is drawn — the rest is what a HitInfo carries, filled in so this goes through the
// same hook the game does rather than a copy of it.
const hitOn = (value: number, bonus: boolean): HitInfo => ({
  points: 300,
  progress: valueProgress(value, NINE_DIAL.maxSum),
  bonus,
  multiplier: bonus ? 4 : 1,
  accFactor: 1,
  spdFactor: 1,
  steps: 4,
  par: 4,
  refGrid: BLANK_GRID,
  value,
  shown: value,
  costLife: false,
})

const noop = () => {
  // Nothing on this stage has a clock to run out or a target to take.
}

// A strike's shot on its own: the board above, the sum below, and the line between them.
//
// The real components with the real geometry — the board is measured the way the game
// measures it and the shot is built by the game's own hook — because what is being
// looked at is where the line lands, and a mock that placed it itself would agree with
// the game right up until it stopped.
export function StrikeVariant({
  mode,
  targets,
  onClose,
}: {
  // Any mode with a shot, which now includes a **challenge** — a flame burns under the
  // keys rather than from the sum, so this is the one entry here that needs a dial under
  // it. `ModeId` rather than `Mode` for that reason alone.
  mode: ModeId
  // How many targets the press takes. Two is the case that decides how a burst is
  // shared, and the only way to see a sweep rather than a single burst.
  targets: 1 | 2
  onClose: () => void
}) {
  const shown = SHOWN.slice(0, targets)
  // The press, replayed on every tap. A fresh seq is what both halves read as a hit.
  const [batch, setBatch] = useState<HitBatch>({ seq: 0, hits: [] })
  const boardRect = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const dial = dialOf(mode)

  const aim = (value: number): ShotAim | null => {
    const board = boardRect.current
    const target = shown.find((entry) => entry.value === value)
    if (board.width === 0 || target === undefined) return null
    return {
      from: {
        x: board.x + board.width / 2,
        y: board.y + board.height + SUM_ROW_HEIGHT / 2,
      },
      to: {
        x: board.x + target.at.x + PIE_SIZE / 2,
        y: board.y + target.at.y + PIE_SIZE / 2,
      },
      radius: PIE_SIZE / 2,
    }
  }

  // One run, forever: this screen fires the same board over and over, and a chain that
  // reset would draw its first beam from the sum row on every press.
  const { shots, removeShot, flame } = useStrikeShots({
    mode,
    runSeq: 0,
    hitBatch: batch,
    aim,
  })

  const fire = () => {
    setBatch((prev) => ({
      seq: prev.seq + 1,
      hits: shown.map((target) => hitOn(target.value, true)),
    }))
  }

  // The sum stands at what it just took, the way it does after a hit.
  const sum = shown[0]?.value ?? 0

  return (
    <Pressable
      className="flex-1 bg-surface px-4 py-2"
      onLongPress={onClose}
      onPress={fire}
    >
      <Text selectable={false} className="font-mono text-[11px] tracking-widest text-dim">
        {`${mode.toUpperCase()} · ${targets === 1 ? 'ONE TARGET' : 'TWO AT ONCE'} · TAP TO FIRE · HOLD TO CLOSE`}
      </Text>
      <View className="flex-1">
        <View
          className="flex-1"
          onLayout={(event) => {
            const { x, y, width, height } = event.nativeEvent.layout
            boardRect.current = { x, y, width, height }
          }}
        >
          {shown.map((target) => (
            <View
              key={target.value}
              style={{ position: 'absolute', left: target.at.x, top: target.at.y }}
            >
              <PieCountdown
                maxValue={NINE_DIAL.maxSum}
                value={target.value}
                active={false}
                clocked
                duration={10_000}
                onComplete={noop}
              />
            </View>
          ))}
        </View>

        <View className="items-center justify-center" style={{ height: SUM_ROW_HEIGHT }}>
          <HitSync seq={batch.seq}>
            <View className="flex-row">
              {String(sum)
                .split('')
                .map((digit, i, arr) => (
                  <ScoreDigit
                    key={arr.length - 1 - i}
                    digit={digit}
                    direction={1}
                    progress={valueProgress(sum, NINE_DIAL.maxSum)}
                  />
                ))}
            </View>
          </HitSync>
        </View>

        {/* The real dial, so the flash is seen on the keys it is drawn on in a run. Its
          gesture is switched off, so a tap on it fires like a tap anywhere else here.
          Only for a flame — every other shot fires from the sum row above. */}
        {dial !== null && modeById(mode)?.shot === 'flame' && (
          <View pointerEvents="none" className="mb-2">
            <Dial
              dial={dial}
              values={cellsOf(dial).map((_, index) => (index * 3 + 2) % dial.digits)}
              showSum={false}
              trainee={false}
              peakFrom={darkGradientOf(mode)[0]}
              peakTo={darkGradientOf(mode)[1]}
              flame={flame}
              onDelta={noop}
              onSet={noop}
            />
          </View>
        )}

        <View pointerEvents="none" className="absolute inset-0 overflow-visible">
          {shots.map((shot) => (
            <StrikeShot
              key={shot.id}
              kind={shot.kind}
              fromX={shot.from.x}
              fromY={shot.from.y}
              toX={shot.to.x}
              toY={shot.to.y}
              radius={shot.radius}
              rounds={shot.rounds}
              onDone={() => {
                removeShot(shot.id)
              }}
            />
          ))}
        </View>
      </View>
    </Pressable>
  )
}
