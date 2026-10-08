import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Dial } from '@/components/game/dial'
import { MultiplayerCorner } from '@/components/game/multiplayer-corner'
import { PieCountdown } from '@/components/game/pie-countdown'
import { ScoreDigit } from '@/components/game/score-digit'
import { TrackedPressable } from '@/components/tracked-pressable'
import { PIE_SIZE } from '@/constants/game'
import { TYPE } from '@/constants/typography'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { useMultiplayerDial } from '@/hooks/use-multiplayer-dial'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { cn } from '@/lib/cn'
import { valueProgress } from '@/lib/value-progress'
import {
  DARK_MULTIPLAYER_GRADIENT,
  labelOf,
  lerpColor,
  MULTIPLAYER_GRADIENT,
  NINE_DIAL,
  sumOf,
} from '@/modes'
import type { MultiMode, MultiTarget, PlayerState } from '@/types/multiplayer'

const SPEED_TIMEOUT = 7000
const ACCURACY_TIMEOUT = 10000
const MULTI_PIE_SIZE = Math.round(PIE_SIZE * 1.5)
const FLASH_REVERT_MS = 700
const NEXT_TARGET_DELAY_MS = 600

// The three bars of the menu button, drawn straight on the surface rather than in a
// token: a wash of the primary ink, so it sits a shade quieter than the labels beside it.
const MENU_BAR_COLOR = 'rgba(0,0,0,0.18)'

// Each player gets a gradient "slice" along the mode color spectrum.
// Ordered by player index from GAME_START — consistent across all clients.
function playerGradients(
  mode: MultiMode,
): [[string, string], [string, string], [string, string], [string, string]] {
  const [c0, c1] = MULTIPLAYER_GRADIENT[mode]
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
  targetCount,
  onHit,
  onTargetExpire,
  onMenu,
}: {
  mode: MultiMode
  userId: string | null
  players: PlayerState[]
  currentTarget: MultiTarget | null
  targetCount: number
  onHit: (accuracy: number) => void
  onTargetExpire: () => void
  onMenu: () => void
}) {
  const { t } = useLingui()
  const insets = useSafeAreaInsets()

  const { grid, handlePress, handleSet } = useMultiplayerDial({
    targetValue: currentTarget?.value ?? null,
    onHit,
  })

  const sum = sumOf(NINE_DIAL, grid)
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

  return (
    <View className="absolute inset-0 bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── Top bar ── */}
      <View className="flex-row items-center px-4 py-2">
        <View className="flex-1">
          <Text
            selectable={false}
            className={TYPE.button}
            style={{ color: myGradient[0] }}
          >
            {t(labelOf(mode))}
          </Text>
          <Text selectable={false} className={cn(TYPE.label, 'text-dim')}>
            <Trans>MULTIPLAYER</Trans>
          </Text>
        </View>
        <View className="items-center">
          <Text
            selectable={false}
            className="font-mono text-[24px] font-black tracking-[8px] pl-[8px]"
            style={{ color: myGradient[1] }}
          >
            {/* The game's name, the one string that is the same in every language.
                The left padding answers the tracking the last letter carries, which
                would otherwise leave the word 4px left of the bar's centre. */}
            NINE
          </Text>
          <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
            {Math.min(targetCount + 1, 10)} / 10
          </Text>
        </View>
        <View className="flex-1 items-end">
          <TrackedPressable id="multiplayer_game.menu" onPress={onMenu} hitSlop={12}>
            <View className="gap-1">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="w-[18px] h-0.5 rounded-[1px]"
                  style={{ backgroundColor: MENU_BAR_COLOR }}
                />
              ))}
            </View>
          </TrackedPressable>
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
              maxValue={NINE_DIAL.maxSum}
              key={displayedTarget.id}
              value={displayedTarget.value}
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
                backgroundColor: '#E8E4DC',
              }}
            />
          )}
        </View>
      </View>

      {/* ── Sum display ── */}
      {/* Reserved, so the dial sits at one height whatever the sum reads. */}
      <View className="items-center justify-center" style={{ height: SUM_ROW_HEIGHT }}>
        <View className="flex-row">
          {String(sum)
            .split('')
            .map((digit, i, arr) => (
              <ScoreDigit
                key={arr.length - 1 - i}
                digit={digit}
                direction={direction}
                progress={valueProgress(sum, NINE_DIAL.maxSum)}
              />
            ))}
        </View>
      </View>

      {/* ── Dial ── */}
      {/* Content height, not a share of the remainder — the same reason as the single
          player screen: the dial's size comes from the width, so it cannot be asked to
          fit inside half of whatever height is left. */}
      <Dial
        dial={NINE_DIAL}
        values={grid.flat()}
        showSum={false}
        trainee={false}
        peakFrom={DARK_MULTIPLAYER_GRADIENT[mode][0]}
        peakTo={DARK_MULTIPLAYER_GRADIENT[mode][1]}
        onDelta={handlePress}
        onSet={handleSet}
      />
    </View>
  )
}
