import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { useRef } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { useTheme } from '@/hooks/use-theme'
import { earnedChallenge, nextChallenge } from '@/lib/next-challenge'
import {
  DARK_MODE_GRADIENT,
  DIFFICULTIES,
  MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { GameOverTitle } from './game-over-title'
import { HighScores } from './high-scores'
import { RunStats } from './run-stats'

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
  strikes,
  avgAccuracy,
  avgSpeed,
  onPlayAgain,
  onChallenge,
  onMenu,
  onAddNickname,
  titleHidden = false,
  onTitleLayout,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  score: number
  hits: number
  // How many of those hits landed on a streak — the challenge is offered on it.
  strikes: number
  avgAccuracy: number
  avgSpeed: number
  // Straight back into a run on this same board.
  onPlayAgain: () => void
  // Into a run on the board one rung up — see `nextChallenge`.
  onChallenge: (mode: Mode, difficulty: Difficulty) => void
  onMenu: () => void
  onAddNickname: () => void
  // When the in-game dying sequence flies its own copy of the title up into
  // place, the overlay hides its title until the hand-off completes, and reports
  // where the title sits (window centre-Y) so the flying copy can land on it.
  titleHidden?: boolean
  onTitleLayout?: (centerY: number) => void
}) {
  const titleRef = useRef<View>(null)
  const { colorScheme } = useTheme()
  const dimColor = colorScheme === 'dark' ? '#504e6e' : '#aaa69e'
  const challenge = earnedChallenge(hits, strikes)
    ? nextChallenge(gameMode, difficulty)
    : null

  return (
    <Screen overlay>
      <View className="w-full items-center justify-between" style={{ minHeight: 560 }}>
        {/* Top: title + score + stats + leaderboard */}
        <View className="w-full items-center">
          {/* GAME OVER — two rows of four animated letters */}
          <View
            ref={titleRef}
            className="mb-3"
            style={{ opacity: titleHidden ? 0 : 1 }}
            onLayout={() => {
              if (!onTitleLayout) return
              titleRef.current?.measureInWindow((_x, y, _w, h) => {
                onTitleLayout(y + h / 2)
              })
            }}
          >
            <GameOverTitle gameMode={gameMode} />
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

          <RunStats hits={hits} avgAccuracy={avgAccuracy} avgSpeed={avgSpeed} />

          {isOneOf(gameMode, ['accuracy', 'speed']) && (
            <HighScores
              gameMode={gameMode}
              difficulty={difficulty}
              userId={userId}
              nickname={nickname}
              optimisticScore={score}
              optimisticHits={hits}
              onAddNickname={onAddNickname}
            />
          )}
        </View>

        {/* Bottom: the two ways back into a run, then the way out. Three equal
            buttons would make leaving as loud as playing; the ladder — CTA, card
            pill, text link — says which one the screen is for. */}
        <View className="items-center gap-6">
          <View className="w-56 gap-3">
            <Pressable
              onPress={onPlayAgain}
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
                  PLAY AGAIN
                </Text>
              </LinearGradient>
            </Pressable>
            {challenge !== null && (
              <Pressable
                onPress={() => {
                  onChallenge(challenge.mode, challenge.difficulty)
                }}
                className="items-center rounded-2xl bg-card py-4"
              >
                <Text
                  selectable={false}
                  numberOfLines={1}
                  className="font-mono text-[13px] font-black tracking-[2px] text-primary"
                >
                  {challenge.label}
                </Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={onMenu} hitSlop={10}>
            <View className="flex-row items-center gap-1">
              <Ionicons name="home-outline" size={10} color={dimColor} />
              <Text
                selectable={false}
                className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
              >
                MENU
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
