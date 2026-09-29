import { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { HitSync } from '@/components/game/hit-sync'
import { PieCountdown } from '@/components/game/pie-countdown'
import { ScoreDigit } from '@/components/game/score-digit'
import { StrikeShot } from '@/components/game/strike-shot'
import { PIE_SIZE } from '@/constants/game'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { useStrikeShots, type ShotAim } from '@/hooks/use-strike-shots'
import { useTheme } from '@/hooks/use-theme'
import { valueProgress } from '@/lib/value-progress'
import type { Grid, HitBatch, HitInfo } from '@/machines/game'
import type { Mode } from '@/machines/modes'
import type { Position } from '@/types/game'

// Two values, and where each sits on the board. A strike needs a live multiplier, which
// in a real run means a chain of exact or fast presses — so this stage deals the press
// instead, and the effect can be watched as many times as it takes to judge 200ms.
const SHOWN = [
  { value: 147, at: { x: 120, y: 40 } },
  { value: 96, at: { x: 16, y: 150 } },
] as const satisfies readonly { value: number; at: Position }[]

const BLANK_GRID: Grid = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]

// One hit of a press, as the machine would report it. Only `value` and `bonus` decide
// what is drawn — the rest is what a HitInfo carries, filled in so this goes through the
// same hook the game does rather than a copy of it.
const hitOn = (value: number, bonus: boolean): HitInfo => ({
  points: 300,
  progress: valueProgress(value),
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
  mode: Mode
  // How many targets the press takes. Two is the case that decides how a burst is
  // shared, and the only way to see a sweep rather than a single burst.
  targets: 1 | 2
  onClose: () => void
}) {
  const { colorScheme } = useTheme()
  const isDark = colorScheme === 'dark'
  const shown = SHOWN.slice(0, targets)
  // The press, replayed on every tap. A fresh seq is what both halves read as a hit.
  const [batch, setBatch] = useState<HitBatch>({ seq: 0, hits: [] })
  const boardRect = useRef({ x: 0, y: 0, width: 0, height: 0 })

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
                value={target.value}
                isDark={isDark}
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
                    isDark={isDark}
                    progress={valueProgress(sum)}
                  />
                ))}
            </View>
          </HitSync>
        </View>

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
