import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { isOneOf } from 'narrowland'
import { VariableContextProvider } from 'nativewind'
import { useEffect, useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import { Screen } from '@/components/screen'
import {
  DIM_INK,
  GOLD_DIM_INK,
  GOLD_SCREEN_TOKENS,
  MODE_SCREEN_TOKENS,
} from '@/constants/colors'
import { CROWN_CORONA, ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { useBoardContext } from '@/hooks/use-board'
import { useTheme } from '@/hooks/use-theme'
import type { AchievementStore } from '@/lib/achievement-store'
import type { AchievementFacts, Award } from '@/lib/achievements'
import type { Period } from '@/lib/announcements'
import { currentBoardMedals } from '@/lib/board-medals'
import type { RecordScreen } from '@/lib/champions'
import type { TitleWords } from '@/lib/game-over-title'
import { runChallenge } from '@/lib/next-challenge'
import { ratingOf } from '@/lib/player-profile'
import {
  DARK_MODE_GRADIENT,
  MODE_GRADIENT,
  SCORED_MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'
import { DIFFICULTIES, MODES } from '@/machines/modes'

import { BoardBadges } from './board-badges'
import { BoardMedals } from './board-medals'
import { EarnedAchievements } from './earned-achievements'
import { GameOverTitle } from './game-over-title'
import { HighScores } from './high-scores'
import { RecordBackdrop } from './record-backdrop'
import { RunStats } from './run-stats'
import { ScoreReadout } from './score-readout'

// What the screen wears over its title. The crown is a reign — both Extreme all-time
// boards at once; a bird is one of them, and each mode gets the one that describes what
// it asks for: an owl's eye for Accuracy, an eagle's dive for Speed.
const EMBLEM = {
  crown: '👑',
  accuracy: '🦉',
  speed: '🦅',
} as const

// The score's glow on the gold screen — the crown's white, so the two read as one
// pair of lights rather than two different ideas.
const WHITE_GLOW = 'rgba(255, 255, 255, 0.95)'

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
  gameTimeMs,
  strikes,
  record,
  screen,
  titleWords,
  avgAccuracy,
  avgSpeed,
  achievements,
  achievementStore,
  achievementFacts,
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
  gameTimeMs: number
  // How many of those hits landed on a streak — the challenge is offered on it.
  strikes: number
  // The biggest board record this run took, or null for a run that took none. Drives
  // the celebration behind the screen, and the gold when it is the all-time one.
  record: Period | null
  // How loudly this screen is celebrating — see `recordScreen`. Latched with the run,
  // so a board moving under the player cannot change it while they are looking at it.
  screen: RecordScreen
  // Decided by the sequence so the flying copy and this one always agree.
  titleWords: TitleWords
  avgAccuracy: number
  avgSpeed: number
  // What this run earned for good — empty on most runs, and silent when it is.
  achievements: readonly Award[]
  // Only for the card a tapped chip opens — see EarnedAchievements.
  achievementStore: AchievementStore
  achievementFacts: AchievementFacts
  // Straight back into a run on this same board.
  onPlayAgain: () => void
  // Into a run on the board one rung up, or one down — see `runChallenge`.
  onChallenge: (mode: Mode, difficulty: Difficulty) => void
  onMenu: () => void
  // When the in-game dying sequence flies its own copy of the title up into
  // place, the overlay hides its title until the hand-off completes, and reports
  // where the title sits (window centre-Y) so the flying copy can land on it.
  titleHidden?: boolean
  onTitleLayout?: (centerY: number) => void
}) {
  const { t } = useLingui()
  const titleRef = useRef<View>(null)
  const { colorScheme } = useTheme()
  const dimColor = DIM_INK[colorScheme]
  const challenge = runChallenge(gameMode, difficulty, hits, strikes)
  // Named so the catalog carries one `TRY {modeName}` shared with the step-up toast,
  // and so a translation can put the rung wherever its own grammar wants it.
  const rungName = challenge === null ? '' : t(DIFFICULTIES[challenge.difficulty].label)
  const modeName = challenge === null ? '' : t(MODES[challenge.mode].label)

  // What this run put on each period of this board: the medal the player can go and see
  // on the board afterwards, and only when this run is what earned it. Not their
  // standing — a place held since last week is not something this game did.
  // The two painted screens carry a celebration behind every glyph, so they take the
  // haloes and an emblem; the tinted one keeps the ordinary screen's ink.
  const onGold = screen === 'crown'
  const painted = screen === 'crown' || screen === 'bird'
  const emblem = onGold
    ? EMBLEM.crown
    : screen === 'bird' && isOneOf(gameMode, ['accuracy', 'speed'])
      ? EMBLEM[gameMode]
      : null
  const board = useBoardContext()

  // The crown lands rather than being there. Keyed off `titleHidden` and not off mount:
  // the overlay is mounted invisibly from the first frame of the dying sequence, so an
  // entrance on mount would play behind the run and be over before anyone saw it.
  const crownIn = useSharedValue(0)
  useEffect(() => {
    if (titleHidden) {
      crownIn.value = 0
      return
    }
    crownIn.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 220 }))
  }, [titleHidden, crownIn])

  const crownStyle = useAnimatedStyle(() => ({
    // The spring overshoots past 1, which is what gives the pop — good on the scale,
    // wrong on the opacity, so that one is clamped.
    opacity: Math.min(1, crownIn.value),
    transform: [{ scale: 0.6 + crownIn.value * 0.4 }],
  }))
  const medals = currentBoardMedals(board, score, userId)

  return (
    <Screen overlay>
      {/* Behind the content, above the screen's own background: the celebration this
          run earned, looping until the player leaves. */}
      {record !== null && (
        <RecordBackdrop record={record} screen={screen} gameMode={gameMode} />
      )}
      {/* All time paints the screen gold, so every token underneath is re-bound for
          this subtree — the classes already on these components re-ink themselves
          rather than each one growing a prop for the one case it happens on. */}
      <VariableContextProvider
        value={onGold ? GOLD_SCREEN_TOKENS : screen === 'bird' ? MODE_SCREEN_TOKENS : {}}
      >
        <View className="w-full items-center justify-between" style={{ minHeight: 560 }}>
          {/* Top: title + score + stats + leaderboard */}
          <View className="w-full items-center">
            {/* The all-time record is the only one that gets a crown, and it hides
                with the title rather than on its own: the dying sequence flies a copy
                of the title up to this spot, and a crown already sitting over an empty
                gap would give away where the letters are about to land. */}
            {emblem !== null && (
              <Animated.View className="mb-1" style={crownStyle}>
                {/* The float lives on the Text as a class, the entrance on the View as
                    a transform: both write `transform`, and on one element the CSS
                    animation and the spring would overwrite each other. */}
                <Text
                  selectable={false}
                  className="letter-float-1 text-[44px] leading-[52px]"
                  style={CROWN_CORONA}
                >
                  {emblem}
                </Text>
              </Animated.View>
            )}
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
              <GameOverTitle gameMode={gameMode} words={titleWords} shadow={painted} />
            </View>

            <BoardBadges gameMode={gameMode} difficulty={difficulty} />

            {/* Unlabelled: under a title this size the number can only be the score,
                and the label was a third line of small caps on a screen that already
                had too many. Unframed here — a card would box the headline in against
                the celebration behind it — and lit from behind instead, in the mode's
                own colour so the score says which board it was set on. On gold the
                glow turns white: the mode's hue would light gold with gold. */}
            <ScoreReadout
              score={score}
              color={MODE_GRADIENT[gameMode][0]}
              glow={painted ? WHITE_GLOW : `${MODE_GRADIENT[gameMode][0]}99`}
            />

            {/* What the run is worth away from this board. The score above is what was
                scored here; this is what it counts for once it is added to the other
                five, where a point from Extreme is worth four from Easy — see
                `scoreWeight` in machines/modes.ts. The profile explains the weights in
                full; one line here is what makes a player wonder enough to go and look.

                Only where there is a rating to add to: Trainee reaches no board and no
                counter, and a run that scored nothing adds nothing worth a line. */}
            {isOneOf(gameMode, SCORED_MODES) && score > 0 && (
              <Text
                selectable={false}
                className="mb-2 font-mono text-[9px] font-bold tracking-[1px] text-dim"
                style={painted ? ON_GOLD_LABEL_SHADOW : null}
              >
                <Trans>+{ratingOf(score, difficulty)} TO YOUR RATING</Trans>
              </Text>
            )}

            <BoardMedals medals={medals} gameMode={gameMode} shadow={painted} />

            <RunStats
              hits={hits}
              gameTimeMs={gameTimeMs}
              avgAccuracy={avgAccuracy}
              avgSpeed={avgSpeed}
              halo={painted}
            />

            {/* Under the run's own numbers and above the board: what this run *did* is a
                description of the run, and what it earned is something the player keeps
                — which belongs nearer the boards than the stopwatch. */}
            <EarnedAchievements
              awards={achievements}
              store={achievementStore}
              facts={achievementFacts}
              halo={painted}
            />

            {isOneOf(gameMode, ['accuracy', 'speed']) && (
              <HighScores
                gameMode={gameMode}
                userId={userId}
                nickname={nickname}
                halo={painted}
                compact
                pinMedalTab
                runScore={score}
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
                    <Trans>PLAY AGAIN</Trans>
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
                    {challenge.kind === 'stepUp' ? (
                      <Trans>STEP UP TO {rungName}</Trans>
                    ) : challenge.kind === 'stepDown' ? (
                      <Trans>STEP DOWN TO {rungName}</Trans>
                    ) : (
                      <Trans>TRY {modeName}</Trans>
                    )}
                  </Text>
                </Pressable>
              )}
            </View>
            <Pressable onPress={onMenu} hitSlop={10}>
              <View className="flex-row items-center gap-1">
                {/* The icon's colour is computed rather than a class, so the gold
                    screen's re-bound tokens cannot reach it — it takes the gold dim
                    directly or it stays a theme grey on a gold background. */}
                <Ionicons
                  name="home-outline"
                  size={10}
                  color={onGold ? GOLD_DIM_INK : painted ? '#FFFFFF' : dimColor}
                />
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim"
                  style={painted ? ON_GOLD_LABEL_SHADOW : null}
                >
                  <Trans>HOME</Trans>
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </VariableContextProvider>
    </Screen>
  )
}
