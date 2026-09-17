import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

// Every achievement the game has, in the order the achievements screen lists them.
//
// An achievement is permanent: earned once, never lost, measured against the player's own
// history rather than against anyone else. That is what separates it from a **medal** (a
// board standing, which a rival can take back) and from a **record** (a score crossing,
// which is a moment rather than a thing you keep).
//
// The array is the source of truth and the type derives from it, so the id list can never
// drift out of sync with the union — the same arrangement `ANNOUNCEMENT_IDS` uses. Both
// `ACHIEVEMENTS` here and the rule table in `lib/achievements.ts` then `satisfies` a
// Record over that union, which makes an id without a definition, or without a rule, a
// compile error rather than a gap nobody notices.

export const ACHIEVEMENT_GROUPS = [
  'firstSteps',
  'accuracy',
  'speed',
  'mastery',
  'endurance',
  'boards',
  'held',
  'friends',
  'secret',
] as const

export type AchievementGroup = (typeof ACHIEVEMENT_GROUPS)[number]

export const GROUP_LABELS = {
  firstSteps: 'FIRST STEPS',
  accuracy: 'ACCURACY',
  speed: 'SPEED',
  mastery: 'MASTERY',
  endurance: 'ENDURANCE',
  boards: 'BOARDS',
  held: 'HELD BOARDS',
  friends: 'WITH FRIENDS',
  secret: 'SECRET',
} as const satisfies Record<AchievementGroup, string>

export const ACHIEVEMENT_IDS = [
  'firstHit',
  'graduate',
  'firstRun',
  'allThree',
  'upARung',
  'intoTheDeep',

  'steadyHand',
  'fineWork',
  'surgeon',
  'immaculate',
  'perfectionist',

  'fastStart',
  'slipstream',
  'afterburner',
  'lightning',
  'terminalVelocity',

  'flawlessTen',
  'maxMultiplier',
  'unscathed',
  'deadEye',
  'blur',
  'perfectRoute',

  'tenRuns',
  'hundredRuns',
  'thousandHits',
  'tenThousandHits',
  'twoInARow',
  'sevenDayStreak',
  'longHaul',
  'allSixBoards',

  'onTheBoard',
  'topOfTheBoard',
  'untouchable',
  'tenBests',
  'earlyBird',

  'heldAccuracy',
  'heldSpeed',

  'roomForTwo',
  'winner',
  'fullHouse',

  'theLongWay',
  'nightShift',
] as const

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number]

export type AchievementDef = {
  group: AchievementGroup
  // One emoji, and never one the app already owns: 🦉 and 🦅 are the game-over screen's
  // Extreme all-time birds, and 👑 is the crown — so the only achievement wearing the
  // crown is the one that *is* the crown.
  emblem: string
  // At most TITLE_MAX characters, upper-case. This is what the announcement bar shouts,
  // which is where the cap comes from.
  title: MessageDescriptor
  // One line, on the achievements screen. Sentence case — the title is the shouting.
  hint: MessageDescriptor
  // The goal, for the ones worth counting towards. Its absence means the achievement is
  // a yes or a no and the screen shows no progress bar.
  target?: number
  // Listed as ??? until earned.
  secret?: true
  // Cleared once per board rather than once. A staged achievement is achieved three
  // times — Easy, Hard and Extreme — each on its own board, each with its own date, and
  // a harder board never implies an easier one. The hint says what the target is; the
  // board it was met on is the stage.
  staged?: true
}

// The announcement bar holds 40 characters (MAX_MESSAGE_LENGTH in lib/announcements.ts)
// and the longest template spends 10 of them on "Unlocked: ". A title past this would be
// clipped mid-word on the one screen that shouts it, so `achievements.test.ts` asserts it.
export const TITLE_MAX = 22

// Score ladders are per mode, in each mode's own voice. Accuracy asks for deliberation
// and Speed asks for the opposite, so a shared "score 1 000" would flatten the single
// distinction the two modes exist to draw. Trainee gets none: it keeps no board, and its
// reward is already the coach.
export const ACHIEVEMENTS = {
  // ── First steps ────────────────────────────────────────────────────────────────
  // The ladder for a player whose score is not yet good enough to reach a board, which
  // is every reward the app offered before these.
  firstHit: {
    group: 'firstSteps',
    emblem: '👆',
    title: msg`FIRST HIT`,
    hint: msg`Land your first target.`,
  },
  graduate: {
    group: 'firstSteps',
    emblem: '🎓',
    title: msg`GRADUATE`,
    // The app stores one flag for "done with the tutorial" and does not tell reaching the
    // end from deciding you have seen enough. The wording follows what is actually known.
    hint: msg`Get through the tutorial.`,
  },
  firstRun: {
    group: 'firstSteps',
    emblem: '🏁',
    title: msg`FIRST RUN`,
    hint: msg`Finish a run on a scored board.`,
  },
  allThree: {
    group: 'firstSteps',
    emblem: '🗺️',
    title: msg`ALL THREE`,
    hint: msg`Play Trainee, Accuracy and Speed.`,
  },
  upARung: {
    group: 'firstSteps',
    emblem: '🎚️',
    title: msg`UP A RUNG`,
    hint: msg`Play a Hard board.`,
  },
  intoTheDeep: {
    group: 'firstSteps',
    emblem: '🌋',
    title: msg`INTO THE DEEP`,
    hint: msg`Land a hit on an Extreme board.`,
  },

  // ── Accuracy ───────────────────────────────────────────────────────────────────
  steadyHand: {
    group: 'accuracy',
    emblem: '🎯',
    title: msg`STEADY HAND`,
    hint: msg`Score 250 in Accuracy.`,
    target: 250,
    staged: true,
  },
  fineWork: {
    group: 'accuracy',
    emblem: '🪡',
    title: msg`FINE WORK`,
    hint: msg`Score 1 000 in Accuracy.`,
    target: 1000,
    staged: true,
  },
  surgeon: {
    group: 'accuracy',
    emblem: '📐',
    title: msg`SURGEON`,
    hint: msg`Score 2 500 in Accuracy.`,
    target: 2500,
    staged: true,
  },
  immaculate: {
    group: 'accuracy',
    emblem: '💎',
    title: msg`IMMACULATE`,
    hint: msg`Score 5 000 in Accuracy.`,
    target: 5000,
    staged: true,
  },
  perfectionist: {
    group: 'accuracy',
    emblem: '🧿',
    title: msg`PERFECTIONIST`,
    hint: msg`Score 10 000 in Accuracy.`,
    target: 10000,
    staged: true,
  },

  // ── Speed ──────────────────────────────────────────────────────────────────────
  fastStart: {
    group: 'speed',
    emblem: '🏃',
    title: msg`FAST START`,
    hint: msg`Score 250 in Speed.`,
    target: 250,
    staged: true,
  },
  slipstream: {
    group: 'speed',
    emblem: '💨',
    title: msg`SLIPSTREAM`,
    hint: msg`Score 1 000 in Speed.`,
    target: 1000,
    staged: true,
  },
  afterburner: {
    group: 'speed',
    emblem: '🚀',
    title: msg`AFTERBURNER`,
    hint: msg`Score 2 500 in Speed.`,
    target: 2500,
    staged: true,
  },
  lightning: {
    group: 'speed',
    emblem: '⚡',
    title: msg`LIGHTNING`,
    hint: msg`Score 5 000 in Speed.`,
    target: 5000,
    staged: true,
  },
  terminalVelocity: {
    group: 'speed',
    emblem: '🌠',
    title: msg`TERMINAL VELOCITY`,
    hint: msg`Score 10 000 in Speed.`,
    target: 10000,
    staged: true,
  },

  // ── Mastery ────────────────────────────────────────────────────────────────────
  // Skill inside one run, rather than a total that patience alone reaches.
  flawlessTen: {
    group: 'mastery',
    emblem: '✨',
    title: msg`FLAWLESS TEN`,
    hint: msg`Extend a streak ten times in a row.`,
    target: 10,
  },
  maxMultiplier: {
    group: 'mastery',
    emblem: '🔥',
    title: msg`MAX MULTIPLIER`,
    hint: msg`Reach the ×8 multiplier.`,
  },
  // Not "finish a run without losing a life" — a run *ends* because its lives ran out, so
  // that could never be earned by anyone.
  unscathed: {
    group: 'mastery',
    emblem: '🧊',
    title: msg`UNSCATHED`,
    hint: msg`Reach 25 hits in one run before losing a life.`,
    target: 25,
  },
  deadEye: {
    group: 'mastery',
    emblem: '👁️',
    title: msg`DEAD EYE`,
    hint: msg`Average 95% accuracy over a run of 20 hits or more.`,
  },
  blur: {
    group: 'mastery',
    emblem: '🌀',
    title: msg`BLUR`,
    hint: msg`Average 90% speed over a run of 20 hits or more.`,
  },
  perfectRoute: {
    group: 'mastery',
    emblem: '🧮',
    title: msg`PERFECT ROUTE`,
    hint: msg`Take the shortest route to 25 targets in one run.`,
    target: 25,
  },

  // ── Endurance ──────────────────────────────────────────────────────────────────
  tenRuns: {
    group: 'endurance',
    emblem: '🔁',
    title: msg`TEN RUNS`,
    hint: msg`Finish 10 runs.`,
    target: 10,
  },
  hundredRuns: {
    group: 'endurance',
    emblem: '💠',
    title: msg`HUNDRED RUNS`,
    hint: msg`Finish 100 runs.`,
    target: 100,
  },
  thousandHits: {
    group: 'endurance',
    emblem: '👊',
    title: msg`THOUSAND HITS`,
    hint: msg`Land 1 000 targets across every run.`,
    target: 1000,
  },
  tenThousandHits: {
    group: 'endurance',
    emblem: '🌌',
    title: msg`TEN THOUSAND HITS`,
    hint: msg`Land 10 000 targets across every run.`,
    target: 10000,
  },
  twoInARow: {
    group: 'endurance',
    emblem: '📅',
    title: msg`TWO IN A ROW`,
    hint: msg`Play on two consecutive days.`,
    target: 2,
  },
  sevenDayStreak: {
    group: 'endurance',
    emblem: '🗓️',
    title: msg`SEVEN DAY STREAK`,
    hint: msg`Play seven days running.`,
    target: 7,
  },
  longHaul: {
    group: 'endurance',
    emblem: '⏱️',
    title: msg`LONG HAUL`,
    hint: msg`Keep a single run going for ten minutes.`,
  },
  allSixBoards: {
    group: 'endurance',
    emblem: '🧭',
    title: msg`ALL SIX BOARDS`,
    hint: msg`Post a score on every mode and difficulty.`,
    target: 6,
  },

  // ── Boards ─────────────────────────────────────────────────────────────────────
  onTheBoard: {
    group: 'boards',
    emblem: '⭐',
    title: msg`ON THE BOARD`,
    hint: msg`Finish in the top three on any board.`,
  },
  topOfTheBoard: {
    group: 'boards',
    emblem: '🎖️',
    title: msg`TOP OF THE BOARD`,
    hint: msg`Take first place on any board.`,
  },
  // The one achievement allowed the crown, because it is the crown: the game-over screen
  // already pays it out for holding both Extreme all-time boards at once.
  untouchable: {
    group: 'boards',
    emblem: '👑',
    title: msg`UNTOUCHABLE`,
    hint: msg`Hold first all-time on both Extreme boards at once.`,
  },
  tenBests: {
    group: 'boards',
    emblem: '📈',
    title: msg`TEN BESTS`,
    hint: msg`Beat your own best ten times.`,
    target: 10,
  },
  earlyBird: {
    group: 'boards',
    emblem: '🌅',
    title: msg`EARLY BIRD`,
    hint: msg`Open a day's board with the first score on it.`,
  },

  // ── Held boards ────────────────────────────────────────────────────────────────
  // One per board. The titles borrow MedalLine's clipped register (`🥇 EXT ALL`), where a
  // player already reads `ACC ESY` as a board.
  heldAccuracy: {
    group: 'held',
    emblem: '🛡️',
    title: msg`HELD ACCURACY`,
    hint: msg`Hold an Accuracy all-time record for seven days.`,
    staged: true,
  },
  heldSpeed: {
    group: 'held',
    emblem: '🏰',
    title: msg`HELD SPEED`,
    hint: msg`Hold a Speed all-time record for seven days.`,
    staged: true,
  },

  // ── With friends ───────────────────────────────────────────────────────────────
  roomForTwo: {
    group: 'friends',
    emblem: '🤝',
    title: msg`ROOM FOR TWO`,
    hint: msg`Finish a run in a room with someone else.`,
  },
  winner: {
    group: 'friends',
    emblem: '🏆',
    title: msg`WINNER`,
    hint: msg`Win a run in a room.`,
  },
  fullHouse: {
    group: 'friends',
    emblem: '🎪',
    title: msg`FULL HOUSE`,
    hint: msg`Play a full room — four players, the most one holds.`,
  },

  // ── Secret ─────────────────────────────────────────────────────────────────────
  theLongWay: {
    group: 'secret',
    emblem: '🐢',
    title: msg`THE LONG WAY`,
    hint: msg`Land a target after thirty presses or more.`,
    secret: true,
  },
  nightShift: {
    group: 'secret',
    emblem: '🌙',
    title: msg`NIGHT SHIFT`,
    hint: msg`Finish a run between 2am and 4am.`,
    secret: true,
  },
} as const satisfies Record<AchievementId, AchievementDef>

// `as const satisfies` keeps every entry's literal type, which is what makes a typo in a
// group name or a missing id a compile error — but it also means the optional fields only
// exist on the entries that carry them. This is the widened view, for the code that asks
// every achievement the same question.
export const achievement = (id: AchievementId): AchievementDef => ACHIEVEMENTS[id]

export const ACHIEVEMENT_COUNT = ACHIEVEMENT_IDS.length

// The ids of one group, in catalogue order.
export const groupIds = (group: AchievementGroup): AchievementId[] =>
  ACHIEVEMENT_IDS.filter((id) => ACHIEVEMENTS[id].group === group)
