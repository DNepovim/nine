import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import {
  DARK_MODE_GRADIENT,
  lerpColor,
  MODE_GRADIENT,
  type Difficulty,
  type Mode,
  type Stats,
} from '@/machines/game'

import { AnimatedLetter } from './animated-letter'
import { DifficultySelector } from './difficulty-selector'
import { HighScores } from './high-scores'
import { ModeSelector } from './mode-selector'

export type MenuMode = 'menu' | 'paused' | 'gameOver'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

const titleFor = (mode: MenuMode): string => {
  if (mode === 'gameOver') return 'GAME OVER'
  if (mode === 'paused') return 'PAUSED'
  return 'NINE'
}

export function MenuOverlay({
  mode,
  gameMode,
  stats,
  difficulty,
  currentScore,
  currentHits,
  avgAccuracy,
  avgSpeed,
  onPlay,
  onContinue,
  onNewGame,
  onSetMode,
  onSetDifficulty,
  onOpenAdvanced,
}: {
  mode: MenuMode
  gameMode: Mode
  stats: Stats
  difficulty: Difficulty
  currentScore: number
  currentHits: number
  avgAccuracy: number
  avgSpeed: number
  onPlay: () => void
  onContinue: () => void
  onNewGame: () => void
  onSetMode: (mode: Mode) => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
}) {
  const [focused, setFocused] = useState<Mode | 'arcade'>(gameMode)

  const isPaused = mode === 'paused'
  const isGameOver = mode === 'gameOver'
  const showConfig = mode === 'menu' || isGameOver

  return (
    <Screen overlay topAligned>
      {/* MENU label beside the persistent menu button (dots → cross) on pause */}
      {isPaused && (
        <Text
          selectable={false}
          className="absolute right-11.5 top-3.75 font-mono text-[14px] font-black tracking-[3px] text-muted"
        >
          MENU
        </Text>
      )}

      {/* Current run's score — above the title on pause & game over */}
      {(isPaused || isGameOver) && (
        <View className="mb-5 items-center gap-2">
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
          >
            SCORE
          </Text>
          <Text
            selectable={false}
            className="text-[44px] tracking-[1px] text-score"
            style={{ fontFamily: 'DSEG7' }}
          >
            {currentScore}
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[1.2px] text-dim"
          >
            {`${currentHits} HITS`}
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[1.2px] text-dim"
          >
            {`ACC ${avgAccuracy}%   SPD ${avgSpeed}%`}
          </Text>
        </View>
      )}

      {mode === 'menu' ? (
        <View className="mb-4 flex-row gap-3">
          {(['N', 'I', 'N', 'E'] as const).map((char, i) => (
            <AnimatedLetter
              key={i}
              char={char}
              color={lerpColor(
                MODE_GRADIENT[gameMode][0],
                MODE_GRADIENT[gameMode][1],
                i / 3,
              )}
              mode={gameMode}
              delay={i * 80}
              letterIndex={i}
            />
          ))}
        </View>
      ) : (
        <Text
          selectable={false}
          className="mb-4 font-mono text-[30px] font-black tracking-[4px] text-primary"
        >
          {titleFor(mode)}
        </Text>
      )}

      {showConfig && (
        <ModeSelector
          focused={focused}
          onSelect={(m) => {
            setFocused(m)
            if (m !== 'arcade') onSetMode(m)
          }}
        />
      )}

      {showConfig && focused !== 'arcade' && focused !== 'trainee' && (
        <DifficultySelector
          gameMode={gameMode}
          difficulty={difficulty}
          onSetDifficulty={onSetDifficulty}
        />
      )}

      {showConfig && <HighScores gameMode={gameMode} stats={stats} />}

      {/* Buttons */}
      <View className="w-56 gap-3">
        {isPaused ? (
          <>
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
          </>
        ) : (
          <Pressable
            onPress={onPlay}
            disabled={focused === 'arcade'}
            className="overflow-hidden rounded-2xl"
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
        )}
      </View>

      <Pressable onPress={onOpenAdvanced} hitSlop={10} className="mt-8">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
        >
          ADVANCED OPTIONS
        </Text>
      </Pressable>
    </Screen>
  )
}
