import { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { HitSync } from '@/components/game/hit-sync'
import { PieCountdown } from '@/components/game/pie-countdown'
import { ScoreDigit } from '@/components/game/score-digit'
import { StrikeShot } from '@/components/game/strike-shot'
import { PIE_SIZE } from '@/constants/game'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { useStrikeShots, type ShotAim } from '@/hooks/use-strike-shots'
import { keyCentres } from '@/lib/strike-shot'
import { valueProgress } from '@/lib/value-progress'
import type { HitBatch, HitInfo } from '@/machines/game'
import { dialOf, NINE_DIAL, type Grid, type ModeId } from '@/modes'
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
  // Any mode with a shot, which now includes a **challenge** — a quartet leaves from the
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
  // The dial's box, measured the way the game measures it, so a quartet's four beams
  // land where they would in a run rather than where this file guessed. Zero-sized for
  // the modes that fire from the sum row, which `keyCentres` answers with no muzzles.
  const dialRect = useRef({ x: 0, y: 0, width: 0, height: 0 })
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
      muzzles: dial === null ? [] : keyCentres(dialRect.current, dial),
    }
  }

  const { shots, removeShot } = useStrikeShots({ mode, hitBatch: batch, aim })

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

        {/* The keys, for a shot that leaves from them. Drawn as the dial's own grid of
          cells rather than as a real `Dial`: what is being looked at is where four beams
          start and how they converge, and a live dial on this stage would be a dial the
          stage then has to keep in a state. Only for a quartet — every other shot fires
          from the sum row above and would be drawn over an empty box. */}
        {dial !== null && dial.rows * dial.cols < NINE_DIAL.rows * NINE_DIAL.cols && (
          <View
            className="mb-2 self-center"
            style={{ width: 180, height: (180 / dial.cols) * dial.rows }}
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout
              dialRect.current = { x, y, width, height }
            }}
          >
            {Array.from({ length: dial.rows }, (_, row) => (
              <View key={row} className="flex-1 flex-row">
                {Array.from({ length: dial.cols }, (_, col) => (
                  <View
                    key={col}
                    className="m-0.5 flex-1 items-center justify-center rounded-xl bg-card"
                  >
                    <Text
                      selectable={false}
                      className="font-mono text-[10px] font-bold text-dim"
                    >
                      {String(dial.weights[row * dial.cols + col] ?? '')}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
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
              radius={PIE_SIZE / 2}
              rounds={shot.rounds}
              gradient={shot.gradient}
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
