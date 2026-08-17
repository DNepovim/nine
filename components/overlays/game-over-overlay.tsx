import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { useRef } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { useBoardContext, type PeriodBoard } from '@/hooks/use-board'
import { useTheme } from '@/hooks/use-theme'
import { boardMedals, runMedal } from '@/lib/board-medals'
import type { TitleWords } from '@/lib/game-over-title'
import { earnedChallenge, nextChallenge } from '@/lib/next-challenge'
import { DARK_MODE_GRADIENT, type Difficulty, type Mode } from '@/machines/game'

import { BoardBadges } from './board-badges'
import { BoardMedals } from './board-medals'
import { GameOverTitle } from './game-over-title'
import { HighScores } from './high-scores'
import { RunStats } from './run-stats'
import { ScoreReadout } from './score-readout'

// The medal this run puts on one period, against the five rows that board is holding.
// The player's own rows are marked so a score they already beat cannot be beaten twice.
const earned = (
  period: PeriodBoard,
  score: number,
  userId: string | null,
): 1 | 2 | 3 | null =>
  runMedal(
    score,
    period.rows.map((row) => ({
      score: row.best_score,
      isMine: userId !== null && row.user_id === userId,
    })),
  )

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
  titleWords,
  avgAccuracy,
  avgSpeed,
  onPlayAgain,
  onChallenge,
  onMenu,
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
  // Decided by the sequence so the flying copy and this one always agree.
  titleWords: TitleWords
  avgAccuracy: number
  avgSpeed: number
  // Straight back into a run on this same board.
  onPlayAgain: () => void
  // Into a run on the board one rung up — see `nextChallenge`.
  onChallenge: (mode: Mode, difficulty: Difficulty) => void
  onMenu: () => void
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

  // What this run put on each period of this board: the medal the player can go and see
  // on the board afterwards, and only when this run is what earned it. Not their
  // standing — a place held since last week is not something this game did.
  const board = useBoardContext()
  const medals = boardMedals({
    ever: earned(board.forever, score, userId),
    week: earned(board.week, score, userId),
    today: earned(board.today, score, userId),
  })

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
            <GameOverTitle gameMode={gameMode} words={titleWords} />
          </View>

          <BoardBadges gameMode={gameMode} difficulty={difficulty} />

          {/* Unlabelled: seven-segment digits in the score colour, framed, under a
              GAME OVER title can only be one number — and the label was a third line
              of small caps on a screen that already had too many. */}
          <ScoreReadout score={score} />

          <BoardMedals medals={medals} gameMode={gameMode} />

          <RunStats hits={hits} avgAccuracy={avgAccuracy} avgSpeed={avgSpeed} />

          {isOneOf(gameMode, ['accuracy', 'speed']) && (
            <HighScores gameMode={gameMode} userId={userId} nickname={nickname} />
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
                HOME
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
