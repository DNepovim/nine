import { i18n } from '@lingui/core'
import { useSyncExternalStore } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { StepUpToast } from '@/components/game/step-up-toast'
import { FeedbackReplyOverlay } from '@/components/overlays/feedback-reply-overlay'
import { GameOverOverlay } from '@/components/overlays/game-over-overlay'
import { HowToPlayOverlay } from '@/components/overlays/how-to-play-overlay'
import { MenuOverlay } from '@/components/overlays/menu-overlay'
import { PausedOverlay } from '@/components/overlays/paused-overlay'
import { StepUpOverlay } from '@/components/overlays/step-up-overlay'
import { WhatsNewOverlay } from '@/components/overlays/whats-new-overlay'
import { SplashScreen } from '@/components/splash-screen'
import {
  achievement,
  ACHIEVEMENT_IDS,
  type AchievementId,
} from '@/constants/achievements'
import { DEFAULT_DIAL_CORNERS } from '@/constants/dial-hints'
import { GalleryButton } from '@/dev/gallery-button'
import { ProfileVariant } from '@/dev/profile-variant'
import {
  NAME_TAG,
  SCORE_TAG,
  ScoreStripVariant,
  type NameLength,
  type ScoreLength,
} from '@/dev/score-strip-variant'
import type { ShapeKind } from '@/dev/weekly-recap/recap'
import { WeeklyRecapOverlay } from '@/dev/weekly-recap/recap-overlay'
import { requestAnnouncements } from '@/hooks/use-announcement-request'
import type { LostMedalNews } from '@/hooks/use-lost-medals'
import { EMPTY_STORE } from '@/lib/achievement-store'
import { achievementAnnouncement, type AchievementFacts } from '@/lib/achievements'
import {
  announcementFor,
  type Announcement,
  type AnnouncementId,
  type Period,
} from '@/lib/announcements'
import { emptyCareer } from '@/lib/career'
import type { RecordScreen } from '@/lib/champions'
import type { FeedbackQuote } from '@/lib/feedback-reply'
import { gameOverTitle } from '@/lib/game-over-title'
import type { Medal, MedalPeriod } from '@/lib/medals'
import {
  invitePool,
  openerPool,
  STEP_UP_BOARD,
  STEP_UP_REASONS,
  type StepUpReason,
} from '@/lib/step-up'
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
  guideRead: true,
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

// Which bar opened the step-up toast, one letter, so a switcher label can stay short
// enough to read at a glance.
const REASON_TAGS = {
  clean: 'C',
  welcome: 'W',
} as const satisfies Record<StepUpReason, string>

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
      onOpenMedals={close}
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
      // The same run the game-over stage shows, so the row can be compared on the two
      // screens that carry it.
      achievements={RUN.achievements}
      achievementStore={EMPTY_STORE}
      achievementFacts={FACTS}
      // The defaults, so the row shows a set corner and an empty one at once. Nothing
      // to change here: a variant is a render function with no state of its own.
      corners={DEFAULT_DIAL_CORNERS}
      onSelectCorner={() => undefined}
      // One of the three on, so the stack shows a ticked box and an empty one at once.
      showPar
      onTogglePar={() => undefined}
      showStats={false}
      onToggleStats={() => undefined}
      showRoute={false}
      onToggleRoute={() => undefined}
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

// Who is doing the looking on each of the not-yours entries, so COMPARE WITH ME has a real
// career on both sides of its table. The fullest of the seeded players everywhere except on
// their own profile, where the second fullest stands in — a viewer who is also the viewed
// player is the `mine` entry, and these are the other one.
const GALLERY_VIEWER = {
  ACE_9: SEED_PLAYERS.DOMINO,
  DOMINO: SEED_PLAYERS.ACE_9,
  VORTEX: SEED_PLAYERS.ACE_9,
  BLAZE: SEED_PLAYERS.ACE_9,
  PIXEL: SEED_PLAYERS.ACE_9,
} as const satisfies Record<keyof typeof SEED_PLAYERS, string>

const profile = (name: keyof typeof SEED_PLAYERS, mine = false): Variant => ({
  key: `profile-${name}${mine ? '-me' : ''}`,
  label: mine ? `${name} · ME` : name,
  render: (close) => (
    <ProfileVariant
      userId={SEED_PLAYERS[name]}
      // Viewing your own profile is the one thing this modal does differently — the motto
      // becomes editable — so it gets its own entry rather than being reasoned about.
      //
      // Another seeded player when it is not yours, not a made-up id: COMPARE WITH ME goes
      // and fetches the viewer's own profile, and a viewer the database has never heard of
      // would put the compare table permanently in its error state here. Whoever is being
      // viewed cannot also be the viewer, or the modal would read as your own.
      viewerId={mine ? SEED_PLAYERS[name] : GALLERY_VIEWER[name]}
      onClose={close}
    />
  ),
})

// The answer to a message, as the launch dialog would show it. What varies is the shape
// of the two texts in the card — a sentence, a couple of bullets, or an answer long enough
// to scroll — and whether the message being answered came back with it at all.
//
// Worth a row of buttons because this is the one dialog nobody can summon on purpose: it
// needs a row in `feedback` with an answer written by hand, an unseen stamp, and a build
// gate that lets it through. Seeing the card normally means writing yourself a message and
// answering it in the database.
//
// A fixed date rather than the clock's: the line above the quote is part of what is being
// looked at, and a date that moves between two runs cannot be compared.
const SENT_AT = '2026-09-23T18:42:11.000Z'

const QUOTE: FeedbackQuote = {
  message:
    'Speed on extreme is great but the strip at the bottom keeps flashing a score I never got. Maybe it is the streak?',
  sentAt: SENT_AT,
}

// The longest message a player can send — MAX_FEEDBACK_LENGTH, 800 characters — so the
// three-line clamp above the answer has something to clamp. A quote that fitted would
// prove nothing about the case that does not.
const LONG_QUOTE: FeedbackQuote = {
  message:
    'I have been playing since the first week and I want to say the speed mode on extreme is the best thing in the app, but I keep running into the same thing and I am not sure whether it is a bug or whether I am reading the screen wrong. When I miss a target and the strike lands, the counter under the grid carries on for a beat as if the streak were still going, and then it snaps back to zero. The score in the top bar does not do this, only the strip. It happens most when I am dialling fast, which is most of the time on extreme, so it might be that the strip is simply a frame behind everything else and I am seeing the old number. It is not stopping me playing and honestly I only noticed because I was trying to beat my own best on the week board and kept glancing down. Thank you for making this, it is the only game on my phone.',
  sentAt: SENT_AT,
}

// The ordinary reply: one sentence, because most answers are one sentence.
const SHORT_ANSWER =
  'Fixed in this build — the strip was a frame behind the strike. Thanks for writing in.'

// The shape a longer answer should take rather than a wall of prose, and the one that
// shows the accent: the bullets and the bold both take the mode colour.
const BULLET_ANSWER = `Good catch, and it was two things rather than one:

- The streak counter kept counting for a frame after a strike landed.
- The strip underneath redrew a beat behind the top bar, so you saw the old number twice.

**Both are in this build.** If the count still drifts, send another one — the game state comes with it and that is what found this.`

// Long enough to scroll inside the card's 85% cap, with a heading and a rule in it, so
// what is being looked at is the scrolling answer against the quote that stays put.
const LONG_ANSWER = `Thank you — this one took a while to find and your message is what found it.

## What was happening

The strip under the grid reads the run's streak, and the streak was being cleared one frame later than the strike that clears it. On easy that frame passes before your eye gets there. On extreme, dialling as fast as you were, it lands right under the number you were watching.

- The counter is cleared with the strike now, in the same tick.
- The strip redraws from the same figures as the top bar, so the two cannot disagree again.

---

## What it does not change

Your scores stand. Nothing about scoring moved — the streak the score was paid on was always the right one, it was only the number on screen that lagged.

One more thing, since you mentioned the week board: the strip shows your best for the board you are on, so on extreme it will not follow you to hard. That is deliberate, not the same bug wearing another coat.

Keep them coming.`

const reply = (
  label: string,
  answer: string,
  quote: FeedbackQuote | null,
  // The card wears the mode colour of the run behind it, which is why two of the entries
  // below differ in nothing else.
  mode: Mode = 'accuracy',
): Variant => ({
  key: `reply-${label}`,
  label,
  render: (close) => (
    <FeedbackReplyOverlay
      gameMode={mode}
      answer={answer}
      quote={quote}
      onDismiss={close}
    />
  ),
})

// One cell of the name-length × score-length grid. Every combination rather than a
// switcher, because the two axes fail differently — a long name is cut to fit, a long
// number is not — and it is the pairs that are worth looking at: the row has to hold a
// six-figure record with a sixteen-character name beside it.
const strip = (names: NameLength, scores: ScoreLength): Variant => ({
  key: `strip-${names}-${scores}`,
  label: `${NAME_TAG[names]} · ${SCORE_TAG[scores]}`,
  render: (close) => <ScoreStripVariant names={names} scores={scores} onClose={close} />,
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
        render: (close) => (
          <SplashScreen onDone={close} onExit={noop} hold ready onIntroDone={noop} />
        ),
      },
      {
        key: 'splash-play',
        label: 'PLAY',
        render: (close) => (
          <SplashScreen
            onDone={close}
            onExit={noop}
            hold={false}
            ready
            onIntroDone={noop}
          />
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
    // The one row of the game screen drawn from other people's data, and so the one that
    // breaks on theirs. Each button is a name length and a score length, in that order.
    title: 'SCORE STRIP · NAME · SCORE',
    items: [
      strip('short', 'three'),
      strip('short', 'five'),
      strip('short', 'six'),
      strip('long', 'three'),
      strip('long', 'five'),
      strip('long', 'six'),
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
        render: (close) => <HowToPlayOverlay onClose={close} />,
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
    // First of the three launch dialogs, so first of the three here. Read down the
    // column: the ordinary sentence, then the two longer shapes, then the two halves
    // that can be missing or oversized, then the same answer in the other two modes.
    title: 'FEEDBACK REPLY',
    items: [
      reply('SHORT', SHORT_ANSWER, QUOTE),
      reply('BULLETS', BULLET_ANSWER, QUOTE),
      reply('LONG', LONG_ANSWER, QUOTE),
      // A message at the 800-character cap, clamped to three lines above a short answer.
      reply('LONG QUOTE', SHORT_ANSWER, LONG_QUOTE),
      // A database without the quote migration — see FeedbackReply.quote. The answer
      // starts at the top of the card and nothing is left where the quote was.
      reply('NO QUOTE', BULLET_ANSWER, null),
      reply(MODE_CODE.speed, BULLET_ANSWER, QUOTE, 'speed'),
      reply(MODE_CODE.trainee, BULLET_ANSWER, QUOTE, 'trainee'),
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
      // offer praises the player, the welcome one only counts targets, and they have to
      // sit next to the same invitations without either reading oddly.
      ...STEP_UP_REASONS.flatMap((reason) =>
        openerPool(reason).flatMap((opener, o) =>
          invitePool().map((invite, i) => ({
            key: `step-up-toast-${reason}-${o}-${i}`,
            label: `TOAST ${REASON_TAGS[reason]}${o + 1}${String.fromCharCode(97 + i)}`,
            render: (close: () => void) => (
              <StepUpToast
                opener={opener}
                invite={invite}
                mode={STEP_UP_BOARD.mode}
                onPress={close}
                onDismiss={close}
              />
            ),
          })),
        ),
      ),
    ],
  },
]

// ── The announcement bar ────────────────────────────────────────────────────────
//
// Buttons rather than screens. The bar lives inside the game screen and is driven by a
// hook, so these ask the running app for a line instead of drawing one over it — which is
// the only way to see the wipe, the queue and the celebration that come with it.
//
// Mid-run only: the bar is the best-scores strip wearing another coat, and off a run
// there is no strip on screen to take over. A press made anywhere else is dropped rather
// than kept waiting, so nothing fires into a run that did not ask for it.
type Action = { key: string; label: string; run: () => void }
type ActionSection = { title: string; items: Action[] }

// One rival for all of their news, short enough to leave the words around it room.
const RIVAL_NAME = 'PETR'

// A roll per press, the way a run takes one: the pools carry three or four wordings each
// and a fixed roll would only ever show the first.
const roll = (id: AnnouncementId, name?: string): Announcement =>
  announcementFor(id, Math.random(), name)

const line = (id: AnnouncementId, label: string, name?: string): Action => ({
  key: `announce-${id}`,
  label,
  run: () => {
    requestAnnouncements([roll(id, name)])
  },
})

// The achievement is chosen at the press rather than in this list, so LONGEST is the
// longest title in whichever language the app is currently in.
const unlock = (key: string, label: string, pick: () => AchievementId): Action => ({
  key: `announce-achievement-${key}`,
  label,
  run: () => {
    requestAnnouncements([achievementAnnouncement(pick(), Math.random())])
  },
})

// One button, one id, one label — the three lists below are the ids the bar can be asked
// for, and the sections and the bursts are both built from them so neither can name a
// line the other does not have.
type Line = { id: AnnouncementId; label: string }

// Your own, in the ladder's own order: the personal best, then the three boards biggest
// last, then the two openings. Each one plays a different celebration.
const YOURS: readonly Line[] = [
  { id: 'record', label: 'BEST' },
  { id: 'today', label: 'TODAY' },
  { id: 'week', label: 'WEEK' },
  { id: 'ever', label: 'EVER' },
  { id: 'todayFirst', label: 'TODAY 1ST' },
  { id: 'weekFirst', label: 'WEEK 1ST' },
]

// Someone else pulling ahead of you. News, and plays nothing at all.
const RAISED: readonly Line[] = [
  { id: 'todayRaised', label: 'TODAY UP' },
  { id: 'weekRaised', label: 'WEEK UP' },
  { id: 'everRaised', label: 'EVER UP' },
]

// The same boards taken off you. Each plays the jump run backwards.
const LOST: readonly Line[] = [
  { id: 'todayLost', label: 'TODAY LOST' },
  { id: 'weekLost', label: 'WEEK LOST' },
  { id: 'everLost', label: 'EVER LOST' },
]

const rolls = (lines: readonly Line[], name?: string): Announcement[] =>
  lines.map(({ id }) => roll(id, name))

// Several lines from one press, which is the only way to see the part of the bar that a
// single line cannot show: the queue. A run hands it a backlog — two records crossed on
// consecutive hits, an achievement unlocked by the hit that broke a board — and what
// matters then is not the message but the joins between messages: each one's own way in,
// its five seconds, its wipe, and the gap before the next is allowed to start. Pressing
// two buttons quickly builds a queue too, but not a repeatable one.
const burst = (label: string, build: () => readonly Announcement[]): Action => ({
  key: `announce-burst-${label}`,
  label,
  run: () => {
    requestAnnouncements(build())
  },
})

const titleLength = (id: AchievementId): number => i18n._(achievement(id).title).length

const longestTitle = (): AchievementId =>
  ACHIEVEMENT_IDS.reduce((longest, id) =>
    titleLength(id) > titleLength(longest) ? id : longest,
  )

const ANNOUNCE: ActionSection[] = [
  {
    title: 'ANNOUNCE · YOURS',
    items: YOURS.map(({ id, label }) => line(id, label)),
  },
  {
    // Someone else's, raised first and then taken.
    title: 'ANNOUNCE · RIVAL',
    items: [...RAISED, ...LOST].map(({ id, label }) => line(id, label, RIVAL_NAME)),
  },
  {
    // Both carry the achievement itself, so tapping the bar opens its card the way a real
    // unlock does. LONGEST is what the bar's 40 characters were measured against.
    title: 'ANNOUNCE · EARNED',
    items: [
      unlock('typical', 'TYPICAL', () => 'firstHit'),
      unlock('longest', 'LONGEST', longestTitle),
    ],
  },
  {
    // Read down the row: a plausible run, then the whole of your own ladder, then three
    // that undo themselves, then the three kinds against each other, then everything the
    // three sections above can ask for — around a minute and a half of bar, which is the
    // case that says whether the queue drains cleanly or drifts.
    title: 'ANNOUNCE · IN A ROW',
    items: [
      // What a good run actually crosses in its first handful of hits: the personal best
      // and then the two smaller boards, back to back, three celebrations deep.
      burst('YOURS ×3', () => rolls(YOURS.slice(0, 3))),
      burst('LADDER ×6', () => rolls(YOURS)),
      // Three losses running, each one playing the jump backwards — the heaviest thing
      // the bar does, three times with nothing in between but the wipes.
      burst('LOST ×3', () => rolls(LOST, RIVAL_NAME)),
      // One of each kind, in the ladder's order. All three arrive `own: false` from here,
      // so what is being looked at is the order this list is in rather than the sorting —
      // that lives in lib/announcement-queue.ts and is pinned by its own tests.
      burst('MIXED', () => [
        roll('ever'),
        achievementAnnouncement('flawlessTen', Math.random()),
        roll('weekRaised', RIVAL_NAME),
      ]),
      burst('ALL', () => [
        ...rolls(YOURS),
        ...rolls([...RAISED, ...LOST], RIVAL_NAME),
        achievementAnnouncement(longestTitle(), Math.random()),
      ]),
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
          {/* First, because unlike everything below it these need the app itself running
              underneath — and because a button that fires and is done has nothing to
              scroll back to. Whatever screen is on show is closed on the way, since the
              bar is at the top of the one behind it. */}
          {ANNOUNCE.map((section) => (
            <View key={section.title} className="gap-1.5">
              <Text
                selectable={false}
                className="font-mono text-[8px] font-black tracking-[1.5px] text-dim"
              >
                {section.title}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {section.items.map((action) => (
                  <GalleryButton
                    key={action.key}
                    label={action.label}
                    onPress={() => {
                      show(null)
                      action.run()
                    }}
                  />
                ))}
              </View>
            </View>
          ))}
          <Text
            selectable={false}
            className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
          >
            ↑ MID-RUN ONLY
          </Text>

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
                  <GalleryButton
                    key={v.key}
                    label={v.label}
                    selected={v.key === shown}
                    onPress={() => {
                      show(v.key)
                    }}
                  />
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
