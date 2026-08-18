import { useSyncExternalStore } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { StepUpToast } from '@/components/game/step-up-toast'
import { GameOverOverlay } from '@/components/overlays/game-over-overlay'
import { HowToPlayOverlay } from '@/components/overlays/how-to-play-overlay'
import { PausedOverlay } from '@/components/overlays/paused-overlay'
import { StepUpOverlay } from '@/components/overlays/step-up-overlay'
import type { Period } from '@/lib/announcements'
import type { RecordScreen } from '@/lib/champions'
import { gameOverTitle } from '@/lib/game-over-title'
import { invitePool, openerPool, STEP_UP_BOARD } from '@/lib/step-up'
import {
  DIFFICULTIES,
  type Difficulty,
  type Mode,
  type ScoredMode,
} from '@/machines/game'

// NINE_DEV_GALLERY — a marker for the bundle check. `pnpm build:web` must not contain
// this string: the gallery is reached through a `__DEV__` dynamic import, which
// babel-preset-expo folds away before Metro collects dependencies, so none of this file
// should reach a production bundle. Grep dist/ for the marker to prove it.
//
// Lives outside app/ on purpose. Expo Router registers every file under app/ through
// require.context, so a route here would ship and be reachable by URL in production.
//
// It renders the real overlays inside the running app, so it sees the real board store,
// the real champions, the real fonts and the real theme. A workshop outside the app
// would have to fake all four, and a faked board store is a second implementation of
// the thing being looked at.

type Variant = {
  key: string
  label: string
  render: (close: () => void) => React.ReactElement
}

type Section = { title: string; items: Variant[] }

const RUN = {
  score: 4820,
  hits: 37,
  gameTimeMs: 4 * 60_000 + 12_000,
  strikes: 6,
  avgAccuracy: 84,
  avgSpeed: 71,
}

const noop = () => {
  // The gallery is for looking, not for driving the machine.
}

const MODE_CODE = {
  trainee: 'TRN',
  accuracy: 'ACC',
  speed: 'SPD',
} as const satisfies Record<Mode, string>

// What the run took, in the switcher's own shorthand. An em dash for a run that took
// nothing, which is a variant worth having: the ordinary game over is the one most
// players see and the easiest to forget to look at.
const RANGE_LABEL = {
  today: 'TODAY',
  week: 'WEEK',
  ever: 'EVER',
} as const satisfies Record<Period, string>

// The mark the screen wears over its title — the same rule the overlay uses, repeated
// here so a label can be read without opening the screen it names.
const emblemFor = (screen: RecordScreen, mode: ScoredMode): string =>
  screen === 'crown'
    ? '👑'
    : screen === 'bird'
      ? mode === 'accuracy'
        ? '🦉'
        : '🦅'
      : '·'

const gameOver = (
  screen: RecordScreen,
  mode: ScoredMode,
  difficulty: Difficulty,
  record: Period | null,
  // Overrides the shared RUN mock — the one variant below with a struggled run needs
  // its own low hit count to show the step-down offer instead of the usual dare.
  run: Pick<typeof RUN, 'score' | 'hits' | 'strikes'> = RUN,
): Variant => ({
  key: `go-${screen}-${mode}-${difficulty}-${record ?? 'none'}-${run.hits}`,
  label: `${MODE_CODE[mode]} · ${DIFFICULTIES[difficulty].code} · ${
    record === null ? '—' : RANGE_LABEL[record]
  } · ${emblemFor(screen, mode)}`,
  render: (close) => (
    <GameOverOverlay
      gameMode={mode}
      difficulty={difficulty}
      userId="dev"
      nickname="DONDA"
      score={run.score}
      hits={run.hits}
      gameTimeMs={RUN.gameTimeMs}
      strikes={run.strikes}
      record={record}
      screen={screen}
      titleWords={gameOverTitle(
        {
          screen,
          mode,
          medals: record === null ? [] : [record],
          personalBest: true,
          difficulty,
          score: run.score,
          hits: run.hits,
          strikes: run.strikes,
        },
        0,
      )}
      avgAccuracy={RUN.avgAccuracy}
      avgSpeed={RUN.avgSpeed}
      onPlayAgain={close}
      onChallenge={close}
      onMenu={close}
    />
  ),
})

const paused = (mode: Mode): Variant => ({
  key: `paused-${mode}`,
  label: MODE_CODE[mode],
  render: (close) => (
    <PausedOverlay
      gameMode={mode}
      difficulty="hard"
      userId="dev"
      nickname="DONDA"
      score={RUN.score}
      hits={RUN.hits}
      gameTimeMs={RUN.gameTimeMs}
      avgAccuracy={RUN.avgAccuracy}
      avgSpeed={RUN.avgSpeed}
      onContinue={close}
      onNewGame={close}
      onOpenAdvanced={noop}
      onAddNickname={noop}
    />
  ),
})

const SECTIONS: Section[] = [
  {
    // Read down the column: no record, then each period, then the all-time ladder from
    // a tinted screen to a painted one to a reign.
    title: 'GAME OVER',
    items: [
      gameOver('plain', 'accuracy', 'hard', null),
      gameOver('plain', 'accuracy', 'hard', 'today'),
      gameOver('plain', 'accuracy', 'hard', 'week'),
      gameOver('plain', 'speed', 'easy', 'today'),
      gameOver('wash', 'accuracy', 'hard', 'ever'),
      gameOver('wash', 'speed', 'easy', 'ever'),
      gameOver('bird', 'accuracy', 'extreme', 'ever'),
      gameOver('bird', 'speed', 'extreme', 'ever'),
      gameOver('crown', 'accuracy', 'extreme', 'ever'),
      gameOver('crown', 'speed', 'extreme', 'ever'),
      // The step-down offer: a handful of hits and no streak, well under the
      // struggle bar — see struggledRun in lib/next-challenge.ts.
      gameOver('plain', 'accuracy', 'extreme', null, { score: 210, hits: 1, strikes: 0 }),
    ],
  },
  {
    title: 'PAUSE',
    items: [paused('accuracy'), paused('speed'), paused('trainee')],
  },
  {
    title: 'GUIDE',
    items: [
      {
        key: 'how-to-play',
        label: 'HOW TO PLAY',
        render: (close) => <HowToPlayOverlay onClose={close} />,
      },
    ],
  },
  {
    title: 'STEP UP',
    items: [
      {
        key: 'step-up',
        label: 'OVERLAY',
        render: (close) => (
          <StepUpOverlay
            gameMode={STEP_UP_BOARD.mode}
            difficulty={STEP_UP_BOARD.difficulty}
            onStart={close}
            onOtherMode={close}
          />
        ),
      },
      // Every opener against every invitation, so the pairing that reads worst is the
      // one being looked at rather than the one nobody rolled.
      ...openerPool().flatMap((opener, o) =>
        invitePool().map((invite, i) => ({
          key: `step-up-toast-${o}-${i}`,
          label: `TOAST ${o + 1}${String.fromCharCode(97 + i)}`,
          render: (close: () => void) => (
            <StepUpToast
              opener={opener}
              invite={invite}
              mode={STEP_UP_BOARD.mode}
              onPress={close}
            />
          ),
        })),
      ),
    ],
  },
]

const ALL_VARIANTS = SECTIONS.flatMap((section) => section.items)

// Which screen is on show, kept in the module rather than in a component.
//
// The picker and the screen it shows are mounted in different trees: on desktop the app
// runs inside a phone frame, the picker sits on the desk outside it, and the screen has
// to render inside the app where the board store and the theme are. A module-level store
// is what lets two mount points that share no parent agree, without threading a provider
// across the frame.
let shownKey: string | null = null
const listeners = new Set<() => void>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const getShown = () => shownKey

const show = (key: string | null) => {
  shownKey = key
  for (const fn of listeners) fn()
}

const useShown = () => useSyncExternalStore(subscribe, getShown, getShown)

// Renders inside the app — within the frame on desktop, and within the providers the
// overlays read from.
export function GalleryStage() {
  const shown = useShown()
  const variant = ALL_VARIANTS.find((v) => v.key === shown) ?? null
  if (variant === null) return null

  // Stacked above the app's own overlays, which are absolute and opaque. Set here
  // rather than on a wrapper at the call site: this view exists only while a screen is
  // chosen, where a wrapper would sit over the app for the whole of a dev run.
  return (
    <View className="absolute inset-0" style={{ zIndex: 100 }}>
      {variant.render(() => {
        show(null)
      })}
    </View>
  )
}

// Renders outside the frame, on the desk, on desktop only. Never over the app: the
// point is to look at a screen unobstructed while choosing the next one.
//
// Scrolls vertically, and keeps its scrollbar: an earlier version scrolled sideways with
// the indicator hidden, which on a desktop reads as a dead strip — there is nothing to
// grab and a wheel does not move it.
export function GallerySwitcher() {
  const shown = useShown()

  return (
    <View className="h-full w-52 border-r border-muted bg-surface">
      <View className="flex-1 overflow-hidden">
        <ScrollView contentContainerStyle={{ padding: 8, gap: 10 }}>
          {SECTIONS.map((section) => (
            <View key={section.title} className="gap-1.5">
              <Text
                selectable={false}
                className="font-mono text-[8px] font-black tracking-[1.5px] text-dim"
              >
                {section.title}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {section.items.map((v) => (
                  <Pressable
                    key={v.key}
                    onPress={() => {
                      show(v.key)
                    }}
                    className={
                      v.key === shown
                        ? 'rounded-lg bg-strong px-2 py-1.5'
                        : 'rounded-lg bg-card px-2 py-1.5'
                    }
                  >
                    <Text
                      selectable={false}
                      className={
                        v.key === shown
                          ? 'font-mono text-[9px] font-bold tracking-[0.5px] text-on-strong'
                          : 'font-mono text-[9px] font-bold tracking-[0.5px] text-primary'
                      }
                    >
                      {v.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Outside the scroller, so the way back to the app is always reachable however
            far down the list has been pushed. */}
        <Pressable
          onPress={() => {
            show(null)
          }}
          className="border-t border-muted px-3 py-2"
        >
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold tracking-[1px] text-dim"
          >
            CLOSE
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
