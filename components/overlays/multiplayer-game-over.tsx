import { LinearGradient } from 'expo-linear-gradient'
import { isNonEmptyArray, isOneOf } from 'narrowland'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { AnimatedLetter } from '@/components/overlays/animated-letter'
import { ModeSelector } from '@/components/overlays/mode-selector'
import { RankRow } from '@/components/overlays/rank-row'
import { Screen } from '@/components/screen'
import { cn } from '@/lib/cn'
import { DARK_MODE_GRADIENT, lerpColor, MODE_GRADIENT } from '@/machines/game'
import type { MultiMode, PlayerState } from '@/types/multiplayer'

const ROWS = [
  ['G', 'A', 'M', 'E'],
  ['O', 'V', 'E', 'R'],
]

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

export function MultiplayerGameOver({
  players,
  mode,
  userId,
  isAdmin,
  onReady,
  onModeChange,
  onStartNext,
  onLeave,
}: {
  players: PlayerState[]
  mode: MultiMode
  userId: string | null
  isAdmin: boolean
  onReady: () => void
  onModeChange: (mode: MultiMode) => void
  onStartNext: () => void
  onLeave: () => void
}) {
  const gradPhase = useSharedValue(0)
  const gradStartSv = useSharedValue<string>(MODE_GRADIENT[mode][0])
  const gradEndSv = useSharedValue<string>(MODE_GRADIENT[mode][1])

  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  useEffect(() => {
    gradStartSv.value = MODE_GRADIENT[mode][0]
    gradEndSv.value = MODE_GRADIENT[mode][1]
  }, [mode, gradStartSv, gradEndSv])

  const sorted = [...players].sort((a, b) => b.score - a.score)
  const myPlayer = players.find((p) => p.userId === userId)
  const iAmReady = myPlayer?.ready ?? false
  const nonAdminPlayers = isAdmin ? players.filter((p) => p.userId !== userId) : players
  const allReady =
    isNonEmptyArray(nonAdminPlayers) && nonAdminPlayers.every((p) => p.ready)

  return (
    <Screen overlay topAligned>
      <View className="w-full items-center gap-5">
        {/* GAME OVER title */}
        <View className="items-center gap-1">
          {ROWS.map((word, rowIndex) => (
            <View key={rowIndex} className="flex-row gap-3">
              {word.map((char, colIndex) => {
                const globalIndex = rowIndex * 4 + colIndex
                const tBase = globalIndex / 7
                return (
                  <AnimatedLetter
                    key={globalIndex}
                    char={char}
                    color={lerpColor(
                      MODE_GRADIENT[mode][0],
                      MODE_GRADIENT[mode][1],
                      tBase,
                    )}
                    tBase={tBase}
                    gradStart={gradStartSv}
                    gradEnd={gradEndSv}
                    gradPhase={gradPhase}
                    mode={mode}
                    delay={globalIndex * 80}
                    letterIndex={globalIndex % 4}
                  />
                )
              })}
            </View>
          ))}
        </View>

        {/* Rankings */}
        <View className="w-full rounded-xl bg-card px-4 py-2">
          <Text
            selectable={false}
            className="mb-1 font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
          >
            RESULTS
          </Text>
          {sorted.map((p, i) => (
            <RankRow key={p.userId} player={p} rank={i + 1} userId={userId} />
          ))}
        </View>

        {/* Mode selector (admin only) */}
        {isAdmin && (
          <View className="w-full">
            <ModeSelector
              focused={mode}
              gradPhase={gradPhase}
              items={['accuracy', 'speed']}
              onSelect={(m) => {
                if (isOneOf(m, ['accuracy', 'speed'])) onModeChange(m)
              }}
            />
          </View>
        )}

        {/* Actions */}
        <View className="w-full items-center gap-4">
          {isAdmin && (
            <Pressable
              onPress={onStartNext}
              disabled={!allReady}
              className={cn(
                'w-56 overflow-hidden rounded-2xl',
                !allReady && 'opacity-[0.35]',
              )}
              style={shadow}
            >
              <LinearGradient
                colors={[...DARK_MODE_GRADIENT[mode]]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="items-center py-4"
              >
                <Text
                  selectable={false}
                  className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
                >
                  PLAY AGAIN
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {!isAdmin && !iAmReady && (
            <Pressable
              onPress={onReady}
              className="w-56 overflow-hidden rounded-2xl"
              style={shadow}
            >
              <LinearGradient
                colors={['#2A2B44', '#3a3b5a']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="items-center py-4"
              >
                <Text
                  selectable={false}
                  className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
                >
                  READY
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {!isAdmin && iAmReady && (
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[2px] text-dim"
            >
              WAITING FOR OTHERS…
            </Text>
          )}

          <Pressable onPress={onLeave} hitSlop={10}>
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
            >
              {isAdmin ? 'CANCEL GAME' : 'LEAVE GAME'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
