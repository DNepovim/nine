import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { useTheme } from '@/hooks/use-theme'
import type { TitleWords } from '@/lib/game-over-title'
import { DARK_MODE_GRADIENT, type Difficulty, type Mode } from '@/machines/game'

import { BoardBadges } from './board-badges'
import { GameOverTitle } from './game-over-title'

// Both rows fit the wordmark's 4×2 grid, which is what its colour ramp and entrance
// delays are indexed by — a longer word would run off the end of that ramp.
const TITLE = ['FOR', 'REAL'] as const satisfies TitleWords

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// Where the toast leads: the board about to be played, and one press to play it.
//
// A screen rather than starting the run outright. Trainee hands out infinite lives, so a
// player arriving here has never lost one — dropping them straight into a scored run
// would be the game changing the rules without saying so. The badges say which board it
// is before anything begins, which is the whole job of this screen.
//
// The ladder underneath is the game-over screen's: a CTA, then a text link. Leaving is
// available and quiet; playing is the thing the screen is for.
export function StepUpOverlay({
  gameMode,
  difficulty,
  onStart,
  onOtherMode,
}: {
  gameMode: Mode
  difficulty: Difficulty
  onStart: () => void
  // Out to the intro, where every board is on offer rather than this one.
  onOtherMode: () => void
}) {
  const { colorScheme } = useTheme()
  const dimColor = colorScheme === 'dark' ? '#504e6e' : '#aaa69e'

  return (
    <Screen overlay>
      <View className="w-full items-center">
        {/* The game-over wordmark, borrowed. This screen is the other end of the same
            idea — that one names what a run was worth, this one names what the next one
            is for — and wearing the same letters makes the pair read as one voice. */}
        <View className="mb-4">
          <GameOverTitle gameMode={gameMode} words={TITLE} />
        </View>
        {/* What changes, in the words that matter to someone leaving practice: the
            score goes somewhere, and the lives run out. */}
        <Text
          selectable={false}
          className="mb-6 max-w-3xs text-center font-mono text-[12px] leading-[18px] text-dim"
        >
          Three lives, and every score reaches the board.
        </Text>

        <BoardBadges gameMode={gameMode} difficulty={difficulty} />

        <View className="w-56 items-center gap-6">
          <Pressable
            onPress={onStart}
            className="w-full overflow-hidden rounded-2xl"
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
                START GAME
              </Text>
            </LinearGradient>
          </Pressable>

          {/* The game-over screen's HOME link, in the same dress: same icon, same size,
              same dim ink, and the same destination. Two ways out of a screen that both
              land on the intro should not look like two different doors. */}
          <Pressable onPress={onOtherMode} hitSlop={10}>
            <View className="flex-row items-center gap-1">
              <Ionicons name="home-outline" size={10} color={dimColor} />
              <Text
                selectable={false}
                className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
              >
                TRY ANOTHER MODE
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
