import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { DIM_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import {
  DARK_MODE_GRADIENT,
  MODE_GRADIENT,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { BoardBadges } from './board-badges'
import { HighScores } from './high-scores'
import { ModeTips } from './mode-tips'
import { PauseMark } from './pause-mark'
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
  gameTimeMs,
  avgAccuracy,
  avgSpeed,
  onContinue,
  onRestart,
  onMenu,
  onOpenAdvanced,
  onAddNickname,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  score: number
  hits: number
  gameTimeMs: number
  avgAccuracy: number
  avgSpeed: number
  onContinue: () => void
  onRestart: () => void
  onMenu: () => void
  onOpenAdvanced: () => void
  onAddNickname: () => void
}) {
  const { colorScheme } = useTheme()
  const dimColor = DIM_INK[colorScheme]

  return (
    <Screen overlay>
      <View className="w-full items-center justify-between" style={{ minHeight: 560 }}>
        <View className="w-full items-center">
          {/* The same three pieces the game-over screen opens with, in the same order
              and the same dress: a mark saying what happened, the board it happened on,
              then the number. Only the mark differs — a run that stopped rather than
              one that ended. */}
          <PauseMark gameMode={gameMode} />

          <BoardBadges gameMode={gameMode} difficulty={difficulty} />

          {/* Trainee has no board, so a score here measures nothing. A tip is
              worth more to someone practising than a number they cannot place —
              but the run's own numbers still do, so they come first and the tip
              reads as advice on what they show. */}
          {gameMode !== 'trainee' && (
            <ScoreReadout
              score={score}
              color={MODE_GRADIENT[gameMode][0]}
              glow={`${MODE_GRADIENT[gameMode][0]}99`}
            />
          )}

          <RunStats
            hits={hits}
            gameTimeMs={gameTimeMs}
            avgAccuracy={avgAccuracy}
            avgSpeed={avgSpeed}
          />

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
              compact
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
                  <Trans>CONTINUE</Trans>
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onRestart}
              className="items-center rounded-2xl bg-card py-4"
            >
              <Text
                selectable={false}
                className="font-mono text-[13px] font-black tracking-[2px] text-primary"
              >
                <Trans>RESTART RUN</Trans>
              </Text>
            </Pressable>
          </View>
          {/* The two ways off this screen that are not the run itself, in the dim
              link dress game over uses for the same pair of jobs — small enough that
              neither competes with CONTINUE, which is what most pauses end with.
              Side by side in the same row the intro screen ends with, so the links
              under a screen's buttons sit the same way wherever you meet them. */}
          <View className="flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Pressable onPress={onMenu} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="home-outline" size={10} color={dimColor} />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                >
                  <Trans>HOME</Trans>
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={onOpenAdvanced} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                <Ionicons name="settings-outline" size={10} color={dimColor} />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                >
                  <Trans>OPTIONS</Trans>
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  )
}
