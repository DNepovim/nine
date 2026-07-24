import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DialButton } from '@/components/game/dial-button'
import { MultiplayerCorner } from '@/components/game/multiplayer-corner'
import { PieCountdown } from '@/components/game/pie-countdown'
import { ScoreDigit } from '@/components/game/score-digit'
import { PIE_SIZE } from '@/constants/game'
import { useMultiplayerDial } from '@/hooks/use-multiplayer-dial'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { valueProgress } from '@/lib/value-progress'
import { computeSum, lerpColor, MODE_GRADIENT, MODES } from '@/machines/game'
import type { MultiMode, MultiTarget, PlayerState } from '@/types/multiplayer'

const SPEED_TIMEOUT = 7000
const ACCURACY_TIMEOUT = 10000
const MULTI_PIE_SIZE = Math.round(PIE_SIZE * 1.5)
const FLASH_REVERT_MS = 700
const NEXT_TARGET_DELAY_MS = 600

// Each player gets a gradient "slice" along the mode color spectrum.
// Ordered by player index from GAME_START — consistent across all clients.
function playerGradients(
  mode: MultiMode,
): [[string, string], [string, string], [string, string], [string, string]] {
  const [c0, c1] = MODE_GRADIENT[mode]
  return [
    [lerpColor(c0, c1, 0), lerpColor(c0, c1, 0.25)],
    [lerpColor(c0, c1, 0.25), lerpColor(c0, c1, 0.5)],
    [lerpColor(c0, c1, 0.5), lerpColor(c0, c1, 0.75)],
    [lerpColor(c0, c1, 0.75), lerpColor(c0, c1, 1)],
  ]
}

export function MultiplayerGame({
  mode,
  userId,
  players,
  currentTarget,
  isDark,
  onHit,
  onTargetExpire,
  onMenu,
}: {
  mode: MultiMode
  userId: string | null
  players: PlayerState[]
  currentTarget: MultiTarget | null
  isDark: boolean
  onHit: (accuracy: number) => void
  onTargetExpire: () => void
  onMenu: () => void
}) {
  const insets = useSafeAreaInsets()
  const [dialSize, setDialSize] = useState(0)

  const { grid, handlePress, handleSet } = useMultiplayerDial({
    targetValue: currentTarget?.value ?? null,
    onHit,
  })

  const sum = computeSum(grid)
  const direction = useScoreDirection(sum)

  // Display layout: me at TL, others clockwise TR→BR→BL.
  const me = players.find((p) => p.userId === userId)
  const others = players.filter((p) => p.userId !== userId)
  const slots = [me, others[0], others[1], others[2]] as const

  // Stable gradient per player position — derived from order in `players`
  // array which matches playerOrder from GAME_START (same on every device).
  const gradients = useMemo(() => playerGradients(mode), [mode])

  const gradientOf = (p: PlayerState | undefined): [string, string] => {
    if (!p) return gradients[0]
    const idx = players.findIndex((pl) => pl.userId === p.userId)
    return gradients[idx >= 0 ? idx : 0] ?? gradients[0]
  }

  const myIdx = userId ? players.findIndex((p) => p.userId === userId) : -1
  const myGradient: [string, string] = gradients[myIdx >= 0 ? myIdx : 0] ?? gradients[0]

  // Flash color: the last player who hit the current target.
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Displayed target lags behind currentTarget so the flash is visible before disappearing.
  const [displayedTarget, setDisplayedTarget] = useState<MultiTarget | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (currentTarget !== null) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      setDisplayedTarget(currentTarget)
      setFlashColor(null)
    } else {
      hideTimerRef.current = setTimeout(() => {
        setDisplayedTarget(null)
        setFlashColor(null)
      }, NEXT_TARGET_DELAY_MS)
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [currentTarget])

  useEffect(() => {
    const hitter = players.find((p) => p.hitCurrentTarget)
    if (!hitter) return
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    const idx = players.findIndex((pl) => pl.userId === hitter.userId)
    const flashGrad = gradients[idx >= 0 ? idx : 0] ?? gradients[0]
    setFlashColor(flashGrad[0])
    if (mode === 'accuracy') {
      flashTimerRef.current = setTimeout(() => {
        setFlashColor(null)
      }, FLASH_REVERT_MS)
    }
  }, [players, mode, gradients])

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    },
    [],
  )

  const duration = mode === 'speed' ? SPEED_TIMEOUT : ACCURACY_TIMEOUT
  const barColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'

  return (
    <View className="absolute inset-0 bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── Top bar ── */}
      <View className="flex-row items-center px-4 py-2">
        <View className="flex-1">
          <Text
            selectable={false}
            className="font-mono text-[13px] font-black tracking-[2px]"
            style={{ color: myGradient[0] }}
          >
            {MODES[mode].label}
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            MULTIPLAYER
          </Text>
        </View>
        <Text
          selectable={false}
          className="font-mono text-[24px] font-black tracking-[8px]"
          style={{ color: myGradient[1] }}
        >
          NINE
        </Text>
        <View className="flex-1 items-end">
          <Pressable onPress={onMenu} hitSlop={12}>
            <View className="gap-1">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="w-[18px] h-0.5 rounded-[1px]"
                  style={{ backgroundColor: barColor }}
                />
              ))}
            </View>
          </Pressable>
        </View>
      </View>

      {/* ── Play area: corners + target ── */}
      <View className="flex-1 relative">
        <View className="absolute top-2 left-2 z-[1]">
          <MultiplayerCorner player={slots[0]} isMe gradient={gradientOf(slots[0])} />
        </View>
        <View className="absolute top-2 right-2 z-[1]">
          <MultiplayerCorner
            player={slots[1]}
            isMe={false}
            gradient={gradientOf(slots[1])}
          />
        </View>
        <View className="absolute bottom-2 left-2 z-[1]">
          <MultiplayerCorner
            player={slots[3]}
            isMe={false}
            gradient={gradientOf(slots[3])}
          />
        </View>
        <View className="absolute bottom-2 right-2 z-[1]">
          <MultiplayerCorner
            player={slots[2]}
            isMe={false}
            gradient={gradientOf(slots[2])}
          />
        </View>

        {/* Target centered */}
        <View className="absolute inset-0 items-center justify-center">
          {displayedTarget && (
            <PieCountdown
              key={displayedTarget.id}
              value={displayedTarget.value}
              isDark={isDark}
              active={currentTarget !== null}
              duration={duration}
              onComplete={onTargetExpire}
              size={MULTI_PIE_SIZE}
              backgroundColor={flashColor ?? undefined}
            />
          )}
          {!displayedTarget && (
            <View
              className="rounded-full"
              style={{
                width: MULTI_PIE_SIZE,
                height: MULTI_PIE_SIZE,
                backgroundColor: isDark ? '#1C1D30' : '#E8E4DC',
              }}
            />
          )}
        </View>
      </View>

      {/* ── Sum display ── */}
      <View className="items-center py-1.5">
        <View className="flex-row">
          {String(sum)
            .split('')
            .map((digit, i, arr) => (
              <ScoreDigit
                key={arr.length - 1 - i}
                digit={digit}
                direction={direction}
                isDark={isDark}
                progress={valueProgress(sum)}
              />
            ))}
        </View>
      </View>

      {/* ── Dial ── */}
      <View
        className="flex-1 items-center justify-center"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setDialSize(Math.min(width, height))
        }}
      >
        <View
          style={{ width: dialSize, height: dialSize }}
          className="flex-row flex-wrap"
        >
          {grid.flat().map((value, index) => (
            <DialButton
              key={index}
              value={value}
              isDark={isDark}
              size={Math.floor(dialSize / 3)}
              weight={(Math.floor(index / 3) + 1) * ((index % 3) + 1)}
              showSum={false}
              onDelta={(delta) => {
                handlePress(index, delta)
              }}
              onSet={(v) => {
                handleSet(index, v)
              }}
            />
          ))}
        </View>
      </View>
    </View>
  )
}
