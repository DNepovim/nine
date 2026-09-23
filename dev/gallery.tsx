import { useSyncExternalStore } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { StepUpToast } from '@/components/game/step-up-toast'
import { GameOverOverlay } from '@/components/overlays/game-over-overlay'
import { HowToPlayOverlay } from '@/components/overlays/how-to-play-overlay'
import { MenuOverlay } from '@/components/overlays/menu-overlay'
import { PausedOverlay } from '@/components/overlays/paused-overlay'
import { PlayerProfileOverlay } from '@/components/overlays/player-profile-overlay'
import { StepUpOverlay } from '@/components/overlays/step-up-overlay'
import { WhatsNewOverlay } from '@/components/overlays/whats-new-overlay'
import { SplashScreen } from '@/components/splash-screen'
import { DEFAULT_DIAL_CORNERS } from '@/constants/dial-hints'
import type { ShapeKind } from '@/dev/weekly-recap/recap'
import { WeeklyRecapOverlay } from '@/dev/weekly-recap/recap-overlay'
import type { LostMedalNews } from '@/hooks/use-lost-medals'
import { EMPTY_STORE } from '@/lib/achievement-store'
import type { AchievementFacts } from '@/lib/achievements'
import type { Period } from '@/lib/announcements'
import { emptyCareer } from '@/lib/career'
import type { RecordScreen } from '@/lib/champions'
import { gameOverTitle } from '@/lib/game-over-title'
import type { Medal, MedalPeriod } from '@/lib/medals'
import { invitePool, openerPool, STEP_UP_BOARD, STEP_UP_REASONS } from '@/lib/step-up'
import type { Award } from '@/lib/winnings'
import { awardBlocks } from '@/lib/winnings-announcement'
import {
  DIFFICULTIES,
  emptyStats,
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
  // Two, so the row can be seen wrapping beside the EARNED label.
  achievements: [
    { id: 'flawlessTen', stage: null },
    { id: 'steadyHand', stage: 'extreme' },
  ] as const,
}

// Blank figures behind the card a tapped achievement chip opens. The gallery is for
// looking at the screens, not at one player's progress — every bar in that card sits at
// zero here, which is still enough to see the card itself.
const FACTS: AchievementFacts = {
  career: emptyCareer(),
  stats: emptyStats(),
  run: {
    mode: 'accuracy',
    difficulty: 'extreme',
    score: RUN.score,
    hits: RUN.hits,
    maxStreak: 0,
    cleanHits: 0,
    parHits: 0,
    longestRoute: 0,
    elapsedMs: RUN.gameTimeMs,
    avgAccuracy: RUN.avgAccuracy,
    avgSpeed: RUN.avgSpeed,
    personalBest: false,
    finished: true,
    endedAt: new Date(),
  },
  standings: [],
  crown: false,
  crossed: [],
  tutorialDone: true,
  now: new Date(),
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

// What is left under the title once the news has faded. Two medals rather than none, so
// the swap can be watched landing on something — the empty case has a variant of its own,
// because a slot closing is the one thing that moves the screen.
const MEDALS_KEPT: readonly Medal[] = [
  { mode: 'accuracy', difficulty: 'hard', period: 'week', rank: 2 },
  { mode: 'speed', difficulty: 'extreme', period: 'today', rank: 3 },
]

// A medal taken, and who by. `nickname` goes through the same shortening the line does,
// so a name too long for the slot is a case the gallery can actually show — pass one in
// to see it clipped rather than trusting that it would be.
const taken = (
  mode: ScoredMode,
  difficulty: Difficulty,
  period: MedalPeriod,
  had: 1 | 2 | 3,
  nickname: string | null,
): LostMedalNews => ({
  loss: { mode, difficulty, period, had, now: null },
  taker: nickname === null ? null : { userId: 'dev-rival', nickname },
})

// A night that cost three boards, which is what the sequence exists for.
//
// Already in the order `announcedLosses` would put it — all time, then the week, then the
// day — because the gallery hands this straight to the screen rather than through the hook
// that sorts it. The sorting itself is pinned in lib/lost-medals.test.ts; what is being
// looked at here is how three of them read one after another.
const BAD_NIGHT: readonly LostMedalNews[] = [
  taken('speed', 'extreme', 'ever', 1, 'PETR'),
  taken('accuracy', 'hard', 'week', 2, 'MARTIN'),
  taken('accuracy', 'easy', 'today', 3, 'ADELA'),
]

// The intro screen, with the medals taken off it while the app was closed.
//
// The sequence plays once and then hands the slot back, so it has already finished by the
// time a button is pressed twice — pick a different variant to see it again, which is what
// the NOTHING TAKEN row is there for as much as for the baseline it shows.
//
// The mode and difficulty pills do not move here: a variant is a render function with no
// state of its own, and this screen's selection lives in the machine it is normally wired
// to. The line being looked at is the same whichever board is picked.
const intro = (
  label: string,
  lostMedals: readonly LostMedalNews[],
  medals: readonly Medal[],
): Variant => ({
  key: `intro-${label}`,
  label,
  render: (close) => (
    <MenuOverlay
      gameMode="speed"
      difficulty="extreme"
      userId="dev"
      nickname="DONDA"
      bestScore={RUN.score}
      medals={medals}
      lostMedals={lostMedals}
      onLostMedalsSeen={noop}
      achievementsEarned={12}
      achievementsLatest="flawlessTen"
      achievementsLoaded
      onOpenAchievements={close}
      onPlay={close}
      onSetMode={noop}
      onSetDifficulty={noop}
      onOpenAdvanced={close}
      onAddNickname={close}
      onHowToPlay={close}
      onCreateRoom={close}
      onOpenJoinRoom={close}
    />
  ),
})

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
  label: `${MODE_CODE[mode]} · ${DIFFICULTIES[difficulty].code.message ?? ''} · ${
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
          podium: record !== null,
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
      achievements={RUN.achievements}
      achievementStore={EMPTY_STORE}
      achievementFacts={FACTS}
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
      // The defaults, so the row shows a set corner and an empty one at once. Nothing
      // to change here: a variant is a render function with no state of its own.
      corners={DEFAULT_DIAL_CORNERS}
      onSelectCorner={() => undefined}
      showPar
      onTogglePar={() => undefined}
      traineeTimeoutMs={64000}
      onSetTraineeTimeout={() => undefined}
      onContinue={close}
      onRestart={close}
      onMenu={close}
      onOpenAdvanced={noop}
      onAddNickname={noop}
    />
  ),
})

// The weekly recap, one entry per week shape. The shape is what the prose is chosen by,
// so it is also the only axis worth a row of buttons: a sweep and a scattered week are
// different sentences, where two different sweeps are the same sentence twice.
//
// Each screen rolls its own week to fit the shape and carries NEW WEEK / REPHRASE, so a
// phrasing that only reads well on one set of facts has nowhere to hide.
const SHAPE_LABELS = {
  sweep: 'SWEEP',
  sweepBut: 'ALL BUT ONE',
  split: 'SPLIT',
  scattered: 'SCATTERED',
  quiet: 'QUIET',
  empty: 'EMPTY',
} as const satisfies Record<ShapeKind, string>

const recap = (kind: ShapeKind): Variant => ({
  key: `recap-${kind}`,
  label: SHAPE_LABELS[kind],
  render: (close) => <WeeklyRecapOverlay kind={kind} onDismiss={close} />,
})

// The winnings card, as the launch popup would show it. Built from awards rather than from
// blocks directly, so what the gallery draws has been through the same grouping and
// ordering the real thing uses — a fixture that skipped that could not show a sorting bug.
const won = (
  mode: ScoredMode,
  difficulty: Difficulty,
  score: number,
  wonOn: string,
  period: Award['period'] = 'day',
): Award => ({ period, mode, difficulty, wonOn, score })

const WINNINGS_CASES = {
  ONE: [won('speed', 'extreme', 31219, '2026-09-22')],
  // A day and the week it belongs to, which is the ordinary Monday: the same score pays
  // twice, at ×1 and then ×2.
  'DAY + WEEK': [
    won('speed', 'extreme', 31219, '2026-09-22'),
    won('speed', 'extreme', 31219, '2026-09-14', 'week'),
  ],
  // Several boards in one window, to see the biggest-first ordering inside a block.
  SWEEP: [
    won('speed', 'extreme', 31219, '2026-09-22'),
    won('accuracy', 'hard', 9404, '2026-09-22'),
    won('speed', 'easy', 6100, '2026-09-22'),
  ],
  // A player back after a week away — the case that would otherwise never be looked at.
  'CATCH UP': [
    won('speed', 'extreme', 31219, '2026-09-22'),
    won('accuracy', 'hard', 9404, '2026-09-21'),
    won('accuracy', 'extreme', 18800, '2026-09-19'),
    won('speed', 'hard', 12400, '2026-09-18'),
    won('speed', 'extreme', 29050, '2026-09-14', 'week'),
  ],
} as const satisfies Record<string, readonly Award[]>

const winnings = (label: keyof typeof WINNINGS_CASES): Variant => ({
  key: `winnings-${label}`,
  label,
  render: (close) => (
    <WhatsNewOverlay
      cards={[{ kind: 'winnings', blocks: awardBlocks(WINNINGS_CASES[label]) }]}
      onDismiss={close}
    />
  ),
})

// The profile modal, against the players `supabase/seed.sql` creates. Not a mock: the
// overlay fetches its own profile, and pointing it at a real seeded id is what lets the
// gallery show the real RPC, the real rating and the real winnings arithmetic rather than
// a hand-built object that would agree with itself no matter what the server did.
//
// Needs the local stack — `pnpm db:start && pnpm db:reset`. Against an empty or remote
// database these draw "this profile could not be loaded", which is itself a state worth
// having a button for.
//
// The ids are the seed's own. If the seed's players change, these go stale and say so
// loudly by failing to load.
const SEED_PLAYERS = {
  // Five days and a week — the fullest rating the seed produces.
  ACE_9: '5eed0000-0000-0000-0000-000000000001',
  // Two days and a week, on two different boards.
  DOMINO: '5eed0000-0000-0000-0000-000000000002',
  // A single day, won once — and the fastest career in the seed, averaging past the
  // fast band, so their name runs all the way to the speed stop.
  VORTEX: '5eed0000-0000-0000-0000-000000000008',
  // Unremarkable at both factors. The case that decides whether a name coloured by a
  // career says anything at all: if the middle of the range reads as nothing, most
  // players see nothing.
  BLAZE: '5eed0000-0000-0000-0000-000000000004',
  // Has only ever played today, so has won nothing: the rating is scored points alone and
  // the line under it promises winnings that are not there yet.
  PIXEL: '5eed0000-0000-0000-0000-000000000007',
} as const

const profile = (name: keyof typeof SEED_PLAYERS, mine = false): Variant => ({
  key: `profile-${name}${mine ? '-me' : ''}`,
  label: mine ? `${name} · ME` : name,
  render: (close) => (
    <PlayerProfileOverlay
      userId={SEED_PLAYERS[name]}
      // Viewing your own profile is the one thing this modal does differently — the motto
      // becomes editable — so it gets its own entry rather than being reasoned about.
      viewerId={mine ? SEED_PLAYERS[name] : 'dev'}
      onClose={close}
    />
  ),
})

const SECTIONS: Section[] = [
  {
    // First in the list because it is first on screen. Two of them, because half of what
    // this screen is is a sequence: HELD is the finished picture, standing still for as
    // long as it is looked at — the same still frame the install popup is shown over —
    // and PLAY runs the whole thing through and closes itself on the way out.
    title: 'SPLASH',
    items: [
      {
        key: 'splash-held',
        label: 'HELD',
        render: (close) => <SplashScreen onDone={close} hold onIntroDone={noop} />,
      },
      {
        key: 'splash-play',
        label: 'PLAY',
        render: (close) => (
          <SplashScreen onDone={close} hold={false} onIntroDone={noop} />
        ),
      },
    ],
  },
  {
    // Second, the way it is second on screen. Only the medal line differs between these:
    // how many were taken changes whether it is a line or a sequence, the metal and the
    // board change what each one says, and whether anything is left underneath changes
    // what the screen does once the last of them has gone.
    title: 'INTRO',
    items: [
      intro('NOTHING TAKEN', [], MEDALS_KEPT),
      intro('ONE', [taken('speed', 'extreme', 'ever', 1, 'PETR')], MEDALS_KEPT),
      // Two boards, which is the shortest thing that is a sequence rather than a line:
      // the second has to arrive as the next sentence and not as a flicker.
      intro('TWO', BAD_NIGHT.slice(0, 2), MEDALS_KEPT),
      // The full three: the all-time gold, then the week, then the day.
      intro('THREE', BAD_NIGHT, MEDALS_KEPT),
      // A name past the ten the line shortens to, which is where it starts to crowd the
      // words around it.
      intro(
        'LONG NAME',
        [taken('speed', 'hard', 'week', 1, 'NEPORAZITELNY')],
        MEDALS_KEPT,
      ),
      // A board that would not say who has it. The medal is gone either way, so the line
      // has to run without a name — see takerOf.
      intro('NO NAME', [taken('accuracy', 'extreme', 'ever', 2, null)], MEDALS_KEPT),
      // Everything they had, so the slot closes behind the sequence instead of filling.
      intro('CLEANED OUT', BAD_NIGHT, []),
    ],
  },
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
        // The gallery shows one component at a time, so the tutorial entry point has
        // nowhere to lead — it closes the guide, same as the done button.
        render: (close) => <HowToPlayOverlay onClose={close} onStartTutorial={close} />,
      },
    ],
  },
  {
    // Where winnings actually surface: folded into RATING, under the line that says so.
    title: 'PROFILE',
    items: [
      profile('ACE_9'),
      profile('ACE_9', true),
      profile('DOMINO'),
      profile('VORTEX'),
      profile('BLAZE'),
      profile('PIXEL'),
    ],
  },
  {
    title: 'WINNINGS',
    items: [
      winnings('ONE'),
      winnings('DAY + WEEK'),
      winnings('SWEEP'),
      winnings('CATCH UP'),
    ],
  },
  {
    // Read down the column: from one player taking everything to nobody taking anything.
    title: 'WEEKLY RECAP',
    items: [
      recap('sweep'),
      recap('sweepBut'),
      recap('split'),
      recap('scattered'),
      recap('quiet'),
      recap('empty'),
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
      // one being looked at rather than the one nobody rolled. Both pools: the clean-run
      // offer praises the player, the tutorial one only counts targets, and they have to
      // sit next to the same invitations without either reading oddly.
      ...STEP_UP_REASONS.flatMap((reason) =>
        openerPool(reason).flatMap((opener, o) =>
          invitePool().map((invite, i) => ({
            key: `step-up-toast-${reason}-${o}-${i}`,
            label: `TOAST ${reason === 'clean' ? 'C' : 'T'}${o + 1}${String.fromCharCode(97 + i)}`,
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
