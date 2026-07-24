import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { ModeSelector } from '@/components/overlays/mode-selector'
import { PlayerSlot } from '@/components/overlays/player-slot'
import { Screen } from '@/components/screen'
import { cn } from '@/lib/cn'
import {
  DARK_MODE_GRADIENT,
  lerpColor,
  MODE_DESCRIPTIONS,
  MODE_GRADIENT,
} from '@/machines/game'
import type { MultiMode, RoomPlayer } from '@/types/multiplayer'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

export function MultiplayerWaiting({
  code,
  mode,
  players,
  userId,
  isAdmin,
  onLeave,
  onStart,
  onSetMode,
}: {
  code: string
  mode: MultiMode
  players: RoomPlayer[]
  userId: string | null
  isAdmin: boolean
  onLeave: () => void
  onStart: () => void
  onSetMode: (mode: MultiMode) => void
}) {
  const canStart = isAdmin && players.length >= 2
  const gradPhase = useSharedValue(0)
  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  const [c0, c1] = MODE_GRADIENT[mode]
  const slotColors = [
    lerpColor(c0, c1, 0),
    lerpColor(c0, c1, 0.25),
    lerpColor(c0, c1, 0.5),
    lerpColor(c0, c1, 0.75),
  ] as const

  return (
    <Screen overlay topAligned>
      <View className="w-full items-center gap-7">
        {/* Code display */}
        <View className="items-center gap-2">
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[3px] text-dim"
          >
            GAME CODE
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[48px] font-black tracking-[8px] text-primary"
          >
            {code}
          </Text>
        </View>

        {/* Mode — selector for admin, label for guest */}
        {isAdmin ? (
          <ModeSelector
            focused={mode}
            gradPhase={gradPhase}
            items={['accuracy', 'speed']}
            onSelect={(m) => {
              if (isOneOf(m, ['accuracy', 'speed'])) onSetMode(m)
            }}
          />
        ) : (
          <View className="items-center gap-1">
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[2px]"
              style={{ color: MODE_GRADIENT[mode][0] }}
            >
              {mode.toUpperCase()} MODE
            </Text>
            <Text
              selectable={false}
              className="px-6 text-center font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
            >
              {MODE_DESCRIPTIONS[mode]}
            </Text>
          </View>
        )}

        {/* Player list */}
        <View className="w-full rounded-xl bg-card px-4 py-2">
          <View className="mb-1 flex-row px-2">
            <Text
              selectable={false}
              className="w-7 font-mono text-[8px] font-bold tracking-[1px] text-dim"
            >
              #
            </Text>
            <Text
              selectable={false}
              className="flex-1 font-mono text-[8px] font-bold tracking-[1px] text-dim"
            >
              PLAYER
            </Text>
          </View>
          {[0, 1, 2, 3].map((i) => {
            const player = players[i]
            return (
              <PlayerSlot
                key={i}
                player={player}
                index={i}
                color={slotColors[i] ?? slotColors[0]}
                isMe={userId !== null && player?.user_id === userId}
              />
            )
          })}
        </View>

        {/* Actions */}
        <View className="w-full items-center gap-4">
          {isAdmin && (
            <Pressable
              onPress={onStart}
              disabled={!canStart}
              className={cn(
                'w-56 overflow-hidden rounded-2xl',
                !canStart && 'opacity-[0.35]',
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
                  START GAME
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {!isAdmin && (
            <View className="items-center gap-2">
              <View className="h-1.5 w-1.5 animate-pulse rounded-full bg-dim" />
              <Text
                selectable={false}
                className="font-mono text-[9px] font-bold tracking-[2px] text-dim"
              >
                WAITING FOR HOST
              </Text>
            </View>
          )}

          <Pressable onPress={onLeave} hitSlop={10}>
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
            >
              CANCEL
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
