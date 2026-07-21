import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { BUILD_LABEL } from '@/constants/game'
import { mono } from '@/constants/theme'
import {
  ARCADE_TEASER,
  DIFFICULTIES,
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  MODE_COLORS,
  MODE_DESCRIPTIONS,
  MODE_ORDER,
  MODES,
  type Difficulty,
  type Mode,
  type Stats,
} from '@/machines/game'

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
  dsegLoaded,
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
  dsegLoaded: boolean
  onPlay: () => void
  onContinue: () => void
  onNewGame: () => void
  onSetMode: (mode: Mode) => void
  onSetDifficulty: (difficulty: Difficulty) => void
  onOpenAdvanced: () => void
}) {
  const [focused, setFocused] = useState<Mode | 'arcade'>(gameMode)
  const best = stats[gameMode][difficulty]

  const isPaused = mode === 'paused'
  const isGameOver = mode === 'gameOver'
  const showConfig = mode === 'menu' || isGameOver // mode + difficulty + best + build

  return (
    <Screen overlay>
      {/* MENU label beside the persistent menu button (dots → cross) on pause */}
      {isPaused && (
        <Text
          selectable={false}
          className="absolute right-[46px] top-[15px] font-mono text-[14px] font-black tracking-[3px] text-muted"
        >
          MENU
        </Text>
      )}

      {/* Current run's score — above the title on pause & game over */}
      {(isPaused || isGameOver) && (
        <View className="mb-5 items-center gap-2">
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[1.8px] text-dim"
          >
            SCORE
          </Text>
          <Text
            selectable={false}
            className="text-[44px] tracking-[1px] text-score"
            style={{ fontFamily: dsegLoaded ? 'DSEG7' : mono }}
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

      <Text
        selectable={false}
        className={`mb-4 font-mono font-black text-primary ${mode === 'menu' ? 'text-[48px] tracking-[10px]' : 'text-[30px] tracking-[4px]'}`}
      >
        {titleFor(mode)}
      </Text>

      {/* Mode selector — menu & game over */}
      {showConfig && (
        <View className="mb-3 items-center">
          <Text
            selectable={false}
            className="mb-2 font-mono text-[9px] font-bold tracking-[1.8px] text-dim"
          >
            MODE
          </Text>
          <View
            className="flex-row flex-wrap justify-center gap-2 px-6"
            style={{ maxWidth: 340 }}
          >
            {MODE_ORDER.map((m) => {
              const selected = m === gameMode
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    setFocused(m)
                    onSetMode(m)
                  }}
                  className="rounded-xl px-3.5 py-2"
                  style={
                    selected
                      ? { backgroundColor: MODE_COLORS[m] }
                      : { backgroundColor: 'transparent' }
                  }
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[11px] font-black tracking-[1.5px]"
                    style={{ color: selected ? '#FFFFFF' : MODE_COLORS[m] }}
                  >
                    {MODES[m].label}
                  </Text>
                </Pressable>
              )
            })}
            {/* Locked Arcade teaser */}
            <Pressable
              onPress={() => {
                setFocused('arcade')
              }}
              className="flex-row items-center gap-1.5 rounded-xl bg-card px-3.5 py-2 opacity-60"
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px]"
                style={{ color: ARCADE_TEASER.color }}
              >
                {ARCADE_TEASER.label}
              </Text>
              <Text
                selectable={false}
                className="font-mono text-[8px] font-black tracking-[1px] text-dim"
              >
                {ARCADE_TEASER.tag}
              </Text>
            </Pressable>
          </View>
          {/* Description of the focused mode */}
          <Text
            selectable={false}
            className="mt-3 px-8 text-center font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
          >
            {focused === 'arcade'
              ? ARCADE_TEASER.description
              : MODE_DESCRIPTIONS[focused]}
          </Text>
        </View>
      )}

      {/* Difficulty selector — menu & game over */}
      {showConfig && (
        <View className="mb-6 items-center">
          <Text
            selectable={false}
            className="mb-2 font-mono text-[9px] font-bold tracking-[1.8px] text-dim"
          >
            DIFFICULTY
          </Text>
          <View
            className="flex-row flex-wrap justify-center gap-2 px-6"
            style={{ maxWidth: 320 }}
          >
            {DIFFICULTY_ORDER.map((d) => {
              const selected = d === difficulty
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    onSetDifficulty(d)
                  }}
                  className="rounded-xl px-3.5 py-2"
                  style={
                    selected
                      ? { backgroundColor: DIFFICULTY_COLORS[d] }
                      : { backgroundColor: 'transparent' }
                  }
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[11px] font-black tracking-[1.5px]"
                    style={{ color: selected ? '#FFFFFF' : DIFFICULTY_COLORS[d] }}
                  >
                    {DIFFICULTIES[d].label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      {/* Best — menu & game over */}
      {showConfig && (
        <View className="mb-8 items-center rounded-2xl bg-card px-8 py-3">
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[1.8px] text-dim"
          >
            {`BEST · ${MODES[gameMode].label} · ${DIFFICULTIES[difficulty].label}`}
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[28px] font-black leading-tight text-primary"
          >
            {best.score}
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[1.2px] text-dim"
          >
            {`${best.hits} HITS`}
          </Text>
        </View>
      )}

      {/* Buttons */}
      <View className="w-56 gap-3">
        {isPaused ? (
          <>
            {/* CONTINUE is the highlighted primary action */}
            <Pressable
              onPress={onContinue}
              className="items-center rounded-2xl bg-strong py-4"
              style={shadow}
            >
              <Text
                selectable={false}
                className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
              >
                CONTINUE
              </Text>
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
            className="items-center rounded-2xl bg-strong py-4"
            style={shadow}
          >
            <Text
              selectable={false}
              className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
            >
              PLAY GAME
            </Text>
          </Pressable>
        )}
      </View>

      {/* Advanced options link */}
      <Pressable onPress={onOpenAdvanced} hitSlop={10} className="mt-8">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
        >
          ADVANCED OPTIONS
        </Text>
      </Pressable>

      {/* Build identifier */}
      {showConfig && (
        <Text
          selectable={false}
          className="absolute bottom-[24px] font-mono text-[9px] font-bold tracking-[1px] text-dim"
        >
          {BUILD_LABEL}
        </Text>
      )}
    </Screen>
  )
}
