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
  'mountaineer',

  'fastStart',
  'slipstream',
  'afterburner',
  'lightning',
  'terminalVelocity',
  'daredevil',

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

  'heldAccEasy',
  'heldAccHard',
  'heldAccExtreme',
  'heldSpeedEasy',
  'heldSpeedHard',
  'heldSpeedExtreme',

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
  title: string
  // One line, on the achievements screen. Sentence case — the title is the shouting.
  hint: string
  // The goal, for the ones worth counting towards. Its absence means the achievement is
  // a yes or a no and the screen shows no progress bar.
  target?: number
  // Listed as ??? until earned.
  secret?: true
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
    title: 'FIRST HIT',
    hint: 'Land your first target.',
  },
  graduate: {
    group: 'firstSteps',
    emblem: '🎓',
    title: 'GRADUATE',
    hint: 'Finish the tutorial.',
  },
  firstRun: {
    group: 'firstSteps',
    emblem: '🏁',
    title: 'FIRST RUN',
    hint: 'Finish a run on a scored board.',
  },
  allThree: {
    group: 'firstSteps',
    emblem: '🗺️',
    title: 'ALL THREE',
    hint: 'Play Trainee, Accuracy and Speed.',
  },
  upARung: {
    group: 'firstSteps',
    emblem: '🎚️',
    title: 'UP A RUNG',
    hint: 'Play a Hard board.',
  },
  intoTheDeep: {
    group: 'firstSteps',
    emblem: '🌋',
    title: 'INTO THE DEEP',
    hint: 'Play an Extreme board.',
  },

  // ── Accuracy ───────────────────────────────────────────────────────────────────
  steadyHand: {
    group: 'accuracy',
    emblem: '🎯',
    title: 'STEADY HAND',
    hint: 'Score 250 in Accuracy.',
    target: 250,
  },
  fineWork: {
    group: 'accuracy',
    emblem: '🪡',
    title: 'FINE WORK',
    hint: 'Score 1 000 in Accuracy.',
    target: 1000,
  },
  surgeon: {
    group: 'accuracy',
    emblem: '📐',
    title: 'SURGEON',
    hint: 'Score 2 500 in Accuracy.',
    target: 2500,
  },
  immaculate: {
    group: 'accuracy',
    emblem: '💎',
    title: 'IMMACULATE',
    hint: 'Score 5 000 in Accuracy.',
    target: 5000,
  },
  perfectionist: {
    group: 'accuracy',
    emblem: '🧿',
    title: 'PERFECTIONIST',
    hint: 'Score 10 000 in Accuracy.',
    target: 10000,
  },
  mountaineer: {
    group: 'accuracy',
    emblem: '⛰️',
    title: 'MOUNTAINEER',
    hint: 'Score 1 000 on Accuracy Extreme.',
    target: 1000,
  },

  // ── Speed ──────────────────────────────────────────────────────────────────────
  fastStart: {
    group: 'speed',
    emblem: '🏃',
    title: 'FAST START',
    hint: 'Score 250 in Speed.',
    target: 250,
  },
  slipstream: {
    group: 'speed',
    emblem: '💨',
    title: 'SLIPSTREAM',
    hint: 'Score 1 000 in Speed.',
    target: 1000,
  },
  afterburner: {
    group: 'speed',
    emblem: '🚀',
    title: 'AFTERBURNER',
    hint: 'Score 2 500 in Speed.',
    target: 2500,
  },
  lightning: {
    group: 'speed',
    emblem: '⚡',
    title: 'LIGHTNING',
    hint: 'Score 5 000 in Speed.',
    target: 5000,
  },
  terminalVelocity: {
    group: 'speed',
    emblem: '🌠',
    title: 'TERMINAL VELOCITY',
    hint: 'Score 10 000 in Speed.',
    target: 10000,
  },
  daredevil: {
    group: 'speed',
    emblem: '🎢',
    title: 'DAREDEVIL',
    hint: 'Score 1 000 on Speed Extreme.',
    target: 1000,
  },

  // ── Mastery ────────────────────────────────────────────────────────────────────
  // Skill inside one run, rather than a total that patience alone reaches.
  flawlessTen: {
    group: 'mastery',
    emblem: '✨',
    title: 'FLAWLESS TEN',
    hint: 'Extend a streak ten times in a row.',
    target: 10,
  },
  maxMultiplier: {
    group: 'mastery',
    emblem: '🔥',
    title: 'MAX MULTIPLIER',
    hint: 'Reach the ×8 multiplier.',
  },
  // Not "finish a run without losing a life" — a run *ends* because its lives ran out, so
  // that could never be earned by anyone.
  unscathed: {
    group: 'mastery',
    emblem: '🧊',
    title: 'UNSCATHED',
    hint: 'Reach 25 hits in one run before losing a life.',
    target: 25,
  },
  deadEye: {
    group: 'mastery',
    emblem: '👁️',
    title: 'DEAD EYE',
    hint: 'Average 95% accuracy over a run of 20 hits or more.',
  },
  blur: {
    group: 'mastery',
    emblem: '🌀',
    title: 'BLUR',
    hint: 'Average 90% speed over a run of 20 hits or more.',
  },
  perfectRoute: {
    group: 'mastery',
    emblem: '🧮',
    title: 'PERFECT ROUTE',
    hint: 'Take the shortest route to 25 targets in one run.',
    target: 25,
  },

  // ── Endurance ──────────────────────────────────────────────────────────────────
  tenRuns: {
    group: 'endurance',
    emblem: '🔁',
    title: 'TEN RUNS',
    hint: 'Finish 10 runs.',
    target: 10,
  },
  hundredRuns: {
    group: 'endurance',
    emblem: '💠',
    title: 'HUNDRED RUNS',
    hint: 'Finish 100 runs.',
    target: 100,
  },
  thousandHits: {
    group: 'endurance',
    emblem: '👊',
    title: 'THOUSAND HITS',
    hint: 'Land 1 000 targets across every run.',
    target: 1000,
  },
  tenThousandHits: {
    group: 'endurance',
    emblem: '🌌',
    title: 'TEN THOUSAND HITS',
    hint: 'Land 10 000 targets across every run.',
    target: 10000,
  },
  twoInARow: {
    group: 'endurance',
    emblem: '📅',
    title: 'TWO IN A ROW',
    hint: 'Play on two consecutive days.',
    target: 2,
  },
  sevenDayStreak: {
    group: 'endurance',
    emblem: '🗓️',
    title: 'SEVEN DAY STREAK',
    hint: 'Play seven days running.',
    target: 7,
  },
  longHaul: {
    group: 'endurance',
    emblem: '⏱️',
    title: 'LONG HAUL',
    hint: 'Keep a single run going for ten minutes.',
  },
  allSixBoards: {
    group: 'endurance',
    emblem: '🧭',
    title: 'ALL SIX BOARDS',
    hint: 'Post a score on every mode and difficulty.',
    target: 6,
  },

  // ── Boards ─────────────────────────────────────────────────────────────────────
  onTheBoard: {
    group: 'boards',
    emblem: '⭐',
    title: 'ON THE BOARD',
    hint: 'Finish in the top three on any board.',
  },
  topOfTheBoard: {
    group: 'boards',
    emblem: '🎖️',
    title: 'TOP OF THE BOARD',
    hint: 'Take first place on any board.',
  },
  // The one achievement allowed the crown, because it is the crown: the game-over screen
  // already pays it out for holding both Extreme all-time boards at once.
  untouchable: {
    group: 'boards',
    emblem: '👑',
    title: 'UNTOUCHABLE',
    hint: 'Hold first all-time on both Extreme boards at once.',
  },
  tenBests: {
    group: 'boards',
    emblem: '📈',
    title: 'TEN BESTS',
    hint: 'Beat your own best ten times.',
    target: 10,
  },
  earlyBird: {
    group: 'boards',
    emblem: '🌅',
    title: 'EARLY BIRD',
    hint: "Open a day's board with the first score on it.",
  },

  // ── Held boards ────────────────────────────────────────────────────────────────
  // One per board. The titles borrow MedalLine's clipped register (`🥇 EXT ALL`), where a
  // player already reads `ACC ESY` as a board.
  heldAccEasy: {
    group: 'held',
    emblem: '🛡️',
    title: 'HELD ACC ESY',
    hint: 'Hold the Accuracy Easy all-time record for seven days.',
    target: 7,
  },
  heldAccHard: {
    group: 'held',
    emblem: '🛡️',
    title: 'HELD ACC HRD',
    hint: 'Hold the Accuracy Hard all-time record for seven days.',
    target: 7,
  },
  heldAccExtreme: {
    group: 'held',
    emblem: '🛡️',
    title: 'HELD ACC EXT',
    hint: 'Hold the Accuracy Extreme all-time record for seven days.',
    target: 7,
  },
  heldSpeedEasy: {
    group: 'held',
    emblem: '🛡️',
    title: 'HELD SPD ESY',
    hint: 'Hold the Speed Easy all-time record for seven days.',
    target: 7,
  },
  heldSpeedHard: {
    group: 'held',
    emblem: '🛡️',
    title: 'HELD SPD HRD',
    hint: 'Hold the Speed Hard all-time record for seven days.',
    target: 7,
  },
  heldSpeedExtreme: {
    group: 'held',
    emblem: '🛡️',
    title: 'HELD SPD EXT',
    hint: 'Hold the Speed Extreme all-time record for seven days.',
    target: 7,
  },

  // ── With friends ───────────────────────────────────────────────────────────────
  roomForTwo: {
    group: 'friends',
    emblem: '🤝',
    title: 'ROOM FOR TWO',
    hint: 'Finish a run in a room with someone else.',
  },
  winner: {
    group: 'friends',
    emblem: '🏆',
    title: 'WINNER',
    hint: 'Win a run in a room.',
  },
  fullHouse: {
    group: 'friends',
    emblem: '🎪',
    title: 'FULL HOUSE',
    hint: 'Play a full room — four players, the most one holds.',
  },

  // ── Secret ─────────────────────────────────────────────────────────────────────
  theLongWay: {
    group: 'secret',
    emblem: '🐢',
    title: 'THE LONG WAY',
    hint: 'Land a target after thirty presses or more.',
    secret: true,
  },
  nightShift: {
    group: 'secret',
    emblem: '🌙',
    title: 'NIGHT SHIFT',
    hint: 'Finish a run between 2am and 4am.',
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
