import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/cn'
import {
  DARK_MODE_GRADIENT,
  DIFFICULTIES,
  MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { HighScores } from './high-scores'
import { ModeTips } from './mode-tips'
import { RunStats } from './run-stats'
import { ScoreReadout } from './score-readout'

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
  onAddNickname,
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
  onAddNickname: () => void
}) {
  const { colorScheme } = useTheme()
  const dimColor = colorScheme === 'dark' ? '#504e6e' : '#aaa69e'

  return (
    <Screen overlay>
      <View className="w-full items-center justify-between" style={{ minHeight: 560 }}>
        <View className="w-full items-center">
          <Text
            selectable={false}
            className={cn(
              'font-mono text-[9px] font-bold tracking-[2px] text-dim',
              // Trainee has no score block under this line, so the stats would
              // otherwise sit right on top of it.
              gameMode === 'trainee' ? 'mb-5' : 'mb-1',
            )}
          >
            {MODES[gameMode].label} · {DIFFICULTIES[difficulty].label}
          </Text>
          {/* Trainee has no board, so a score here measures nothing. A tip is
              worth more to someone practising than a number they cannot place —
              but the run's own numbers still do, so they come first and the tip
              reads as advice on what they show. */}
          {gameMode !== 'trainee' && <ScoreReadout score={score} />}

          <RunStats hits={hits} avgAccuracy={avgAccuracy} avgSpeed={avgSpeed} />

          {gameMode === 'trainee' && (
            <View className="mb-5 w-full">
              <ModeTips />
            </View>
          )}

          {isOneOf(gameMode, ['accuracy', 'speed']) && (
            <HighScores
              gameMode={gameMode}
              userId={userId}
              nickname={nickname}
              onAddNickname={onAddNickname}
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
                END RUN
              </Text>
            </Pressable>
          </View>
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
        </View>
      </View>
    </Screen>
  )
}
