import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { Screen } from '@/components/screen'
import {
  DARK_MODE_GRADIENT,
  DIFFICULTIES,
  lerpColor,
  MODE_GRADIENT,
  MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { AnimatedLetter } from './animated-letter'
import { HighScores } from './high-scores'

const ROWS = [
  ['G', 'A', 'M', 'E'],
  ['O', 'V', 'E', 'R'],
]
const TOTAL_LETTERS = 8

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

export function GameOverOverlay({
  gameMode,
  difficulty,
  userId,
  nickname,
  score,
  hits,
  avgAccuracy,
  avgSpeed,
  onNewGame,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  score: number
  hits: number
  avgAccuracy: number
  avgSpeed: number
  onNewGame: () => void
}) {
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

  return (
    <Screen overlay>
      <View className="w-full items-center justify-between" style={{ minHeight: 560 }}>
        {/* Top: title + score + stats + leaderboard */}
        <View className="w-full items-center">
          {/* GAME OVER — two rows of four animated letters */}
          <View className="mb-3 items-center gap-1">
            {ROWS.map((word, rowIndex) => (
              <View key={rowIndex} className="flex-row gap-3">
                {word.map((char, colIndex) => {
                  const globalIndex = rowIndex * 4 + colIndex
                  const tBase = globalIndex / (TOTAL_LETTERS - 1)
                  return (
                    <AnimatedLetter
                      key={globalIndex}
                      char={char}
                      color={lerpColor(
                        MODE_GRADIENT[gameMode][0],
                        MODE_GRADIENT[gameMode][1],
                        tBase,
                      )}
                      tBase={tBase}
                      gradStart={gradStartSv}
                      gradEnd={gradEndSv}
                      gradPhase={gradPhase}
                      mode={gameMode}
                      delay={globalIndex * 80}
                      letterIndex={globalIndex % 4}
                    />
                  )
                })}
              </View>
            ))}
          </View>

          {/* Mode · Difficulty subtitle */}
          <Text
            selectable={false}
            className="mb-4 font-mono text-[9px] font-bold tracking-[2px] text-dim"
          >
            {MODES[gameMode].label} · {DIFFICULTIES[difficulty].label}
          </Text>

          {/* Score */}
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
          >
            YOUR SCORE
          </Text>
          <Text
            selectable={false}
            className="mb-5 text-[56px] tracking-[2px]"
            style={{ fontFamily: 'DSEG7', color: '#4ADE80' }}
          >
            {score}
          </Text>

          {/* Stats — labels right-aligned, values left-aligned, boundary at screen centre */}
          <View className="mb-6 flex-row">
            <View className="flex-1 items-end gap-2 pr-4">
              <Text
                selectable={false}
                className="font-mono text-[10px] font-bold tracking-[1.5px] text-dim"
              >
                HITS
              </Text>
              <Text
                selectable={false}
                className="font-mono text-[10px] font-bold tracking-[1.5px] text-dim"
              >
                AVG ACC
              </Text>
              <Text
                selectable={false}
                className="font-mono text-[10px] font-bold tracking-[1.5px] text-dim"
              >
                AVG SPD
              </Text>
            </View>
            <View className="flex-1 items-start gap-2 pl-4">
              <Text
                selectable={false}
                className="font-mono text-[10px] font-bold tracking-[1.5px] text-primary"
              >
                {hits}
              </Text>
              <Text
                selectable={false}
                className="font-mono text-[10px] font-bold tracking-[1.5px] text-primary"
              >
                {avgAccuracy}%
              </Text>
              <Text
                selectable={false}
                className="font-mono text-[10px] font-bold tracking-[1.5px] text-primary"
              >
                {avgSpeed}%
              </Text>
            </View>
          </View>

          {isOneOf(gameMode, ['accuracy', 'speed']) && (
            <HighScores
              gameMode={gameMode}
              difficulty={difficulty}
              userId={userId}
              nickname={nickname}
              optimisticScore={score}
              optimisticHits={hits}
            />
          )}
        </View>

        {/* Bottom: NEW GAME returns to intro */}
        <View className="items-center">
          <Pressable
            onPress={onNewGame}
            className="overflow-hidden rounded-2xl"
            style={shadow}
          >
            <LinearGradient
              colors={[...DARK_MODE_GRADIENT[gameMode]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="w-56 items-center py-4"
            >
              <Text
                selectable={false}
                className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
              >
                NEW GAME
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
