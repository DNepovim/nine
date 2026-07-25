import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { useRef } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import {
  DARK_MODE_GRADIENT,
  DIFFICULTIES,
  MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'

import { GameOverTitle } from './game-over-title'
import { HighScores } from './high-scores'

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
  titleHidden = false,
  onTitleLayout,
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
  // When the in-game dying sequence flies its own copy of the title up into
  // place, the overlay hides its title until the hand-off completes, and reports
  // where the title sits (window centre-Y) so the flying copy can land on it.
  titleHidden?: boolean
  onTitleLayout?: (centerY: number) => void
}) {
  const titleRef = useRef<View>(null)

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
