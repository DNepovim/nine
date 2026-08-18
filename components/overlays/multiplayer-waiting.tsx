import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { useEffect, useState } from 'react'
import { Platform, Pressable, Share, Text, View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { ModeSelector } from '@/components/overlays/mode-selector'
import { PLAYER_GRADIENTS, PlayerTile } from '@/components/overlays/player-tile'
import { Screen } from '@/components/screen'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/cn'
import { SHARE_URL } from '@/lib/invite-message'
import {
  DARK_MULTIPLAYER_GRADIENT,
  MODE_DESCRIPTIONS,
  MULTIPLAYER_GRADIENT,
} from '@/machines/game'
import type { MultiMode, RoomPlayer } from '@/types/multiplayer'

// How long COPY reads as COPIED before reverting — long enough to register,
// short enough that a second tap needs no explanation.
const COPIED_HOLD_MS = 1500

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
  const { colorScheme } = useTheme()
  const dimColor = colorScheme === 'dark' ? '#504e6e' : '#aaa69e'
  const gradPhase = useSharedValue(0)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  const handleCopy = () => {
    void Clipboard.setStringAsync(code)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, COPIED_HOLD_MS)
  }

  const handleShare = () => {
    const invite = `Join my Nine game — code ${code}`
    // iOS takes the link as its own item, so the sheet can offer it to AirDrop and
    // Copy Link; Android ignores `url` and needs it inline.
    void Share.share(
      Platform.OS === 'ios'
        ? { message: invite, url: SHARE_URL }
        : { message: `${invite}\n\n${SHARE_URL}` },
    )
  }

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
          <View className="flex-row items-center gap-5">
            <Pressable onPress={handleCopy} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={10}
                  color={dimColor}
                />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                >
                  {copied ? 'COPIED' : 'COPY'}
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={handleShare} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="share-outline" size={10} color={dimColor} />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                >
                  SHARE
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Mode — selector for admin, label for guest */}
        {isAdmin ? (
          <ModeSelector
            focused={mode}
            gradPhase={gradPhase}
            items={['accuracy', 'speed']}
            gradient={MULTIPLAYER_GRADIENT}
            accentIndex={1}
            onSelect={(m) => {
              if (isOneOf(m, ['accuracy', 'speed'])) onSetMode(m)
            }}
          />
        ) : (
          <View className="items-center gap-1">
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[2px]"
              style={{ color: MULTIPLAYER_GRADIENT[mode][1] }}
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

        {/* Player grid — two tiles per row */}
        <View className="w-full gap-2.5">
          <View className="flex-row items-center justify-between px-1">
            <Text
              selectable={false}
              className="font-mono text-[9px] font-bold tracking-[2px] text-dim"
            >
              PLAYERS
            </Text>
            <Text
              selectable={false}
              className="font-mono text-[9px] font-bold tracking-[2px] text-dim"
            >
              {players.length}/4
            </Text>
          </View>
          <View className="w-full flex-row flex-wrap justify-between gap-y-3">
            {PLAYER_GRADIENTS.map((gradient, i) => (
              <PlayerTile
                key={i}
                nickname={players[i]?.nickname}
                userId={players[i]?.user_id}
                gradient={gradient}
                isMe={userId !== null && players[i]?.user_id === userId}
                isHost={i === 0 && players[i] !== undefined}
              />
            ))}
          </View>
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
                colors={[...DARK_MULTIPLAYER_GRADIENT[mode]]}
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
