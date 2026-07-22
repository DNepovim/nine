import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { Screen } from '@/components/screen'
import {
  DARK_MODE_GRADIENT,
  lerpColor,
  MODE_GRADIENT,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { AnimatedLetter } from './animated-letter'
import { DifficultySelector } from './difficulty-selector'
import { HighScores } from './high-scores'
import { ModeSelector } from './mode-selector'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

export function MenuOverlay({
  gameMode,
  difficulty,
  userId,
  nickname,
  onPlay,
  onSetMode,
  onSetDifficulty,
  onOpenAdvanced,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  onPlay: () => void
  onSetMode: (mode: Mode) => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
}) {
  const [focused, setFocused] = useState<Mode | 'arcade'>(gameMode)

  const gradPhase = useSharedValue(0)
  const gradStartSv = useSharedValue<string>(MODE_GRADIENT[gameMode][0])
  const gradEndSv = useSharedValue<string>(MODE_GRADIENT[gameMode][1])

  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  useEffect(() => {
    gradStartSv.value = MODE_GRADIENT[focused][0]
    gradEndSv.value = MODE_GRADIENT[focused][1]
  }, [focused, gradStartSv, gradEndSv])

  return (
    <Screen overlay>
      <View className="w-full items-center justify-between" style={{ minHeight: 640 }}>
        {/* Top: NINE title + mode/difficulty selectors + leaderboard */}
        <View className="w-full items-center">
          <View className="mb-4 flex-row gap-3">
            {(['N', 'I', 'N', 'E'] as const).map((char, i) => (
              <AnimatedLetter
                key={i}
                char={char}
                color={lerpColor(
                  MODE_GRADIENT[focused][0],
                  MODE_GRADIENT[focused][1],
                  i / 3,
                )}
                tBase={i / 3}
                gradStart={gradStartSv}
                gradEnd={gradEndSv}
                gradPhase={gradPhase}
                mode={focused}
                delay={i * 80}
                letterIndex={i}
              />
            ))}
          </View>

          <ModeSelector
            focused={focused}
            gradPhase={gradPhase}
            onSelect={(m) => {
              setFocused(m)
              if (m !== 'arcade') onSetMode(m)
            }}
          />

          {focused !== 'arcade' && focused !== 'trainee' && (
            <DifficultySelector
              gameMode={gameMode}
              difficulty={difficulty}
              gradPhase={gradPhase}
              onSetDifficulty={onSetDifficulty}
            />
          )}

          {focused !== 'trainee' && focused !== 'arcade' && (
            <HighScores
              gameMode={gameMode}
              difficulty={difficulty}
              userId={userId}
              nickname={nickname}
            />
          )}
        </View>

        {/* Bottom: PLAY GAME + advanced options link */}
        <View className="items-center gap-8">
          <Pressable
            onPress={onPlay}
            disabled={focused === 'arcade'}
            className="w-56 overflow-hidden rounded-2xl"
            style={{ ...shadow, opacity: focused === 'arcade' ? 0.4 : 1 }}
          >
            <LinearGradient
              colors={[...DARK_MODE_GRADIENT[gameMode]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="items-center py-4"
            >
              <Text
                selectable={false}
                className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
              >
                PLAY GAME
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onOpenAdvanced} hitSlop={10}>
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
            >
              ADVANCED OPTIONS
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
