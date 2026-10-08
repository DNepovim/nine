import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { VariableContextProvider } from 'nativewind'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { ScoreReadout } from '@/components/overlays/score-readout'
import { StatRow } from '@/components/overlays/stat-row'
import { Screen } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { RunStat } from '@/lib/run-stats'

// The screen a run stops on, whichever engine was running it and whichever way it
// stopped.
//
// Every run in the app ends up on one of these: the pause screen, the game-over screen,
// and both of arcade's. They were four files with the same body, which is how arcade's
// came to show its score in a card while the other two glowed — the drift took one
// forgotten prop, and nobody had a reason to look.
//
// So the shape is here and the contents are the caller's. What the shape is: a head, the
// number the run was worth, the figures behind that number, whatever the engine wants to
// say next, and at the bottom one loud way back into a run over one quiet way out of it.
// The column is pinned to `MIN_HEIGHT` and spread, so the ways out sit at the foot of the
// screen rather than wherever the content above them happens to end.
//
// A new engine gets all of that by filling in slots, and cannot get the spacing, the
// readout or the button ladder wrong, because none of them is its to decide.

// Tall enough that a short run's screen is laid out like a long one's: the ways out are
// in the same place whether there are high scores above them or nothing at all.
const MIN_HEIGHT = 560

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// The number the run was worth, and what to call it.
export type RunScore = {
  value: number
  // The digits' own colour — the mode's, so the figure says which run it came off.
  color: string
  // What lights it from behind. Derived from the colour, because the readout draws a
  // framed card when it is given nothing and a run screen never wants one: the card
  // boxes the headline in against whatever is playing behind it. Pass one only to
  // override the hue — the gold game-over screen does, since a mode's colour would
  // light gold with gold.
  glow?: string
  // A line under the digits saying what they count, for a run whose score is not points.
  // Omitted where the number can only be the score.
  caption?: ReactNode
}

// The loud way back into a run: PLAY AGAIN, CONTINUE.
export type RunCta = { label: ReactNode; onPress: () => void }

export function RunScreen({
  overRun = false,
  behind = null,
  tokens,
  head,
  score = null,
  beforeStats = null,
  stats,
  halo = false,
  afterStats = null,
  gradient,
  cta,
  alsoCta = null,
  exits = null,
}: {
  // The run is still underneath. Set where the screen stops a run rather than ending it,
  // so the board it was stopped on stays visible behind the scrim.
  overRun?: boolean
  // Behind the content and above the screen's own background: the celebration a run
  // earned, looping until the player leaves.
  behind?: ReactNode
  // Theme tokens re-bound for everything on this screen. The all-time-record screen
  // paints itself gold, and the classes already on these components re-ink themselves
  // rather than each one growing a prop for the one case it happens on.
  tokens?: Record<string, string>
  // What the screen is: a pause mark, or a game-over title with its badges.
  head: ReactNode
  score?: RunScore | null
  // Between the score and the figures — a medal standing, a line about what the score was
  // worth. Where the run's *result* goes, as against its description.
  beforeStats?: ReactNode
  stats: readonly RunStat[]
  // Set on the gold game-over screen, where the figures sit straight on the celebration.
  halo?: boolean
  // Under the figures — achievements, a board, a run's own options. Where everything the
  // run touched but did not consist of goes.
  afterStats?: ReactNode
  // The CTA's two stops, which are the mode's dark pair.
  gradient: readonly [string, string]
  cta: RunCta
  // Under the CTA and in the same column: a second, quieter button. Three equal buttons
  // would make leaving as loud as playing, so this one is a card pill rather than a
  // gradient.
  alsoCta?: ReactNode
  // The quiet row at the very bottom: the ways out, as text with an icon.
  exits?: ReactNode
}) {
  return (
    <Screen overlay overRun={overRun}>
      {behind}
      <VariableContextProvider value={tokens ?? {}}>
        <View
          className="w-full items-center justify-between"
          style={{ minHeight: MIN_HEIGHT }}
        >
          <View className="w-full items-center">
            {head}

            {score !== null && (
              <View className="items-center">
                <ScoreReadout
                  score={score.value}
                  color={score.color}
                  glow={score.glow ?? `${score.color}99`}
                />
                {score.caption !== undefined && (
                  // Pulled up under the digits, which carry their own bottom margin: the
                  // caption belongs to the number rather than to the row below it.
                  <Text
                    selectable={false}
                    className={cn(TYPE.labelSm, '-mt-3.5 mb-5 text-dim')}
                  >
                    {score.caption}
                  </Text>
                )}
              </View>
            )}

            {beforeStats}

            <StatRow stats={stats} halo={halo} />

            {afterStats}
          </View>

          {/* The ways back and the way out. Three equal buttons would make leaving as loud
              as playing; the ladder — CTA, card pill, text link — says which one the screen
              is for. */}
          <View className="items-center gap-6">
            <View className="w-56 gap-3">
              <TrackedPressable
                id="run_screen.cta"
                onPress={cta.onPress}
                className="overflow-hidden rounded-2xl"
                style={shadow}
              >
                <LinearGradient
                  colors={[...gradient]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="items-center py-4"
                >
                  <Text selectable={false} className={cn(TYPE.button, 'text-on-strong')}>
                    {cta.label}
                  </Text>
                </LinearGradient>
              </TrackedPressable>
              {alsoCta}
            </View>
            {exits}
          </View>
        </View>
      </VariableContextProvider>
    </Screen>
  )
}

// The quieter button under the CTA: a card pill rather than a gradient, so a second way
// back into a run does not shout as loudly as the first. One component because every run
// screen that has one wears it identically, and a copy is how they stop doing that.
export function CardButton({
  label,
  onPress,
}: {
  label: ReactNode
  onPress: () => void
}) {
  return (
    <TrackedPressable
      id="run_screen.secondary"
      onPress={onPress}
      className="items-center rounded-2xl bg-card py-4"
    >
      <Text selectable={false} className={cn(TYPE.button, 'text-primary')}>
        {label}
      </Text>
    </TrackedPressable>
  )
}

// One way off a run screen: a word with an icon saying where it lands, dim enough that
// none of them competes with the CTA above. The label says what it does, the icon says
// where it goes — a player looking for the way out of a run meets it in the same clothes
// wherever they are.
export function RunExit({
  icon,
  label,
  onPress,
}: {
  icon: 'home-outline' | 'settings-outline'
  label: ReactNode
  onPress: () => void
}) {
  return (
    <TrackedPressable id="run_screen.tertiary" onPress={onPress} hitSlop={10}>
      <View className="flex-row items-center gap-1">
        <Ionicons name={icon} size={10} color={DIM_INK} />
        <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
          {label}
        </Text>
      </View>
    </TrackedPressable>
  )
}
