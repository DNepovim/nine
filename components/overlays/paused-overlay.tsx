import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { Pressable, Share, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { useTheme } from '@/hooks/use-theme'
import {
  DARK_MODE_GRADIENT,
  DIFFICULTIES,
  MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { HighScores } from './high-scores'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

export function PausedOverlay({
  gameMode,
  difficulty,
  userId,
  nickname,
  score,
  hits,
  avgAccuracy,
  avgSpeed,
  onContinue,
  onNewGame,
  onOpenAdvanced,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  score: number
  hits: number
  avgAccuracy: number
  avgSpeed: number
  onContinue: () => void
  onNewGame: () => void
  onOpenAdvanced: () => void
}) {
  const { colorScheme } = useTheme()
  const dimColor = colorScheme === 'dark' ? '#504e6e' : '#aaa69e'

  return (
    <Screen overlay>
      <View className="w-full items-center justify-between" style={{ minHeight: 560 }}>
        <View className="w-full items-center">
          <Text
            selectable={false}
            className="mb-1 font-mono text-[9px] font-bold tracking-[2px] text-dim"
          >
            {MODES[gameMode].label} · {DIFFICULTIES[difficulty].label}
          </Text>
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
            />
          )}
        </View>

        <View className="items-center gap-8">
          <View className="w-56 gap-3">
            <Pressable
              onPress={onContinue}
              className="overflow-hidden rounded-2xl"
              style={shadow}
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
                  CONTINUE
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onNewGame}
              className="items-center rounded-2xl bg-card py-4"
            >
              <Text
                selectable={false}
                className="font-mono text-[13px] font-black tracking-[2px] text-primary"
              >
                NEW GAME
              </Text>
            </Pressable>
          </View>
          <View className="flex-row items-center gap-5">
            <Pressable onPress={onOpenAdvanced} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="settings-outline" size={10} color={dimColor} />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                >
                  OPTIONS
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                void Share.share({
                  message: 'https://nine.expo.app',
                  url: 'https://nine.expo.app',
                })
              }}
              hitSlop={10}
            >
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
      </View>
    </Screen>
  )
}
