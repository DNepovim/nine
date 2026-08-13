import { isOneOf } from 'narrowland'

// Announcements take over the best-scores bar for a moment when something worth
// saying happens mid-run — a record you broke, or one a rival took.
//
// Four are your own achievements. Six are about other players: `*Raised` when someone
// pushes a board record up, `*Lost` when the record they took was yours.
//
// The array is the source of truth and the type derives from it, so the id list can
// never drift out of sync with the union — and ANNOUNCEMENT_MESSAGES below `satisfies`
// a Record over that union, which makes an id without a message a compile error.
export const ANNOUNCEMENT_IDS = [
  'record',
  'today',
  'week',
  'ever',
  'todayFirst',
  'weekFirst',
  'todayRaised',
  'weekRaised',
  'everRaised',
  'todayLost',
  'weekLost',
  'everLost',
] as const

export type AnnouncementId = (typeof ANNOUNCEMENT_IDS)[number]

export type Announcement = { id: AnnouncementId; message: string }

// The three board periods, biggest first.
export const PERIODS = ['ever', 'week', 'today'] as const
export type Period = (typeof PERIODS)[number]

const RAISED_ID = {
  ever: 'everRaised',
  week: 'weekRaised',
  today: 'todayRaised',
} as const satisfies Record<Period, AnnouncementId>

const LOST_ID = {
  ever: 'everLost',
  week: 'weekLost',
  today: 'todayLost',
} as const satisfies Record<Period, AnnouncementId>

// Rival lines carry the other player's name. Nicknames are capped at 16 characters in
// the UI and unconstrained in the database, so they are cut to this for display —
// which is also what keeps the rendered line inside the bar.
const NICKNAME_DISPLAY_MAX = 10
const UNKNOWN_NAME = 'SOMEONE'
const NAME_TOKEN = '{name}'

// The longest line the bar can hold at 9px mono, once a name is substituted in.
export const MAX_MESSAGE_LENGTH = 40

export function displayName(nickname: string | null): string {
  const trimmed = nickname?.trim() ?? ''
  if (trimmed === '') return UNKNOWN_NAME
  if (trimmed.length <= NICKNAME_DISPLAY_MAX) return trimmed.toUpperCase()
  return `${trimmed.slice(0, NICKNAME_DISPLAY_MAX - 1)}…`.toUpperCase()
}

// A pool per announcement, drawn from at random, so the same milestone does not always
// greet you with the same line.
//
// Sentence case, not the app's usual shouting caps: the rival's name is upper-cased by
// displayName, so it is the only thing in the bar that shouts and the eye goes to it.
//
// Every line is deliberately mode-neutral: these fire in Accuracy as well as Speed, so
// nothing may claim the player was *fast*. The lightspeed animation carries that
// flavour on its own; the words only say what was achieved.
const ANNOUNCEMENT_MESSAGES = {
  record: ['You beat your best', 'A better you', 'Your best yet', 'A new personal best'],
  today: ['Today belongs to you', 'Crowned for today', 'First today', "Today's best"],
  week: [
    'The week is yours',
    'Crowned for the week',
    'First this week',
    'Unbeaten this week',
  ],
  ever: [
    'Nobody has scored higher',
    'Crowned of all time',
    'First of all time',
    'Untouchable',
  ],

  // Opening an empty board, which is not the same as topping a busy one. The lines say
  // the board was bare rather than that you are ahead — there is nobody to be ahead of
  // — so they cannot be mistaken for the `today` / `week` lines above.
  todayFirst: [
    "You opened today's board",
    'First on the board today',
    'Nobody had scored today',
    'Today starts with you',
  ],
  weekFirst: [
    "You opened this week's board",
    'First on the board this week',
    'Nobody had scored this week',
    'The week starts with you',
  ],

  // Someone else pushed a board record up. Neutral news — it was not yours to lose.
  todayRaised: [
    '{name} now leads today',
    '{name} is ahead of you today',
    'Today: {name} leads',
  ],
  weekRaised: [
    '{name} now leads the week',
    '{name} is ahead this week',
    'This week: {name} leads',
  ],
  everRaised: [
    '{name} now leads all time',
    '{name} is ahead of everyone',
    'All time: {name} leads',
  ],

  // The record they took was yours.
  todayLost: [
    '{name} took today from you',
    '{name} just dethroned you',
    'Today: {name} passed you',
  ],
  weekLost: [
    '{name} took the week from you',
    '{name} took your week',
    'This week: {name} passed you',
  ],
  everLost: [
    '{name} took all time from you',
    '{name} took your crown',
    'All time: {name} passed you',
  ],
} as const satisfies Record<AnnouncementId, readonly [string, ...string[]]>

// Which line to use, given a roll in [0, 1). The roll is a parameter rather than a
// Math.random() call inside, so the choice stays pure and testable and the randomness
// lives at the call site. `name` fills the {name} token in rival lines.
export function messageFor(id: AnnouncementId, roll: number, name?: string): string {
  const pool = ANNOUNCEMENT_MESSAGES[id]
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  const template = pool[index] ?? pool[0]
  return template.replaceAll(NAME_TOKEN, name ?? UNKNOWN_NAME)
}

export const announcementFor = (
  id: AnnouncementId,
  roll: number,
  name?: string,
): Announcement => ({ id, message: messageFor(id, roll, name) })

export const messagePool = (id: AnnouncementId): readonly string[] =>
  ANNOUNCEMENT_MESSAGES[id]

// ─── Your own records ──────────────────────────────────────────────────────────

// Biggest first, so a single hit that clears several records at once announces only
// the one worth shouting about.
//
// Opening a board sits with the record for the same period rather than below it: the
// two are mutually exclusive — a board either has a score to beat or it does not — so
// the pair never compete, and an opening outranks a personal best the same way a
// record does. Being first for the week implies being first today, which is why the
// week's opening is listed above the day's.
const OWN_TIERS = ['ever', 'week', 'weekFirst', 'today', 'todayFirst', 'record'] as const

type OwnTier = (typeof OWN_TIERS)[number]

export type RecordTargets = {
  // The player's own stored best as the run began.
  record: number
  // Board records. Null means unknown — offline, or a board with no scores yet —
  // and an unknown record cannot be beaten.
  today: number | null
  week: number | null
  ever: number | null
  // Whether the period's board is *known* to hold no score at all. Distinct from a null
  // record above, which also covers "we could not find out": claiming to have opened a
  // board we simply failed to read would be a lie the player cannot check.
  todayEmpty: boolean
  weekEmpty: boolean
}

// A record is only broken when there was one to beat: a first score sets the bar
// rather than breaking it, and equalling it is not beating it.
const beaten = (score: number, target: number | null): boolean =>
  target !== null && target > 0 && score > target

// Opening a board takes a score of your own — a run that ends on nothing has not put
// anything there to be first with.
const opened = (score: number, empty: boolean): boolean => empty && score > 0

const ACHIEVED = {
  ever: (score, t) => beaten(score, t.ever),
  week: (score, t) => beaten(score, t.week),
  today: (score, t) => beaten(score, t.today),
  record: (score, t) => beaten(score, t.record),
  weekFirst: (score, t) => opened(score, t.weekEmpty),
  todayFirst: (score, t) => opened(score, t.todayEmpty),
} as const satisfies Record<OwnTier, (score: number, targets: RecordTargets) => boolean>

// Every record this score has passed and every board it has opened, biggest first.
export function crossedRecords(score: number, targets: RecordTargets): AnnouncementId[] {
  return OWN_TIERS.filter((tier) => ACHIEVED[tier](score, targets))
}

// The milestones that belong to a board rather than to the player alone. Opening one
// counts: the score has to reach the board for anyone else to see that it happened.
const BOARD_IDS = [...PERIODS, 'weekFirst', 'todayFirst'] as const

// Whether a crossing is worth publishing to the board before the run is over. A
// personal best is nobody else's business, so only the board milestones count
// — this is what stops a mid-run write for a milestone no rival can see.
export const hasBoardRecord = (crossed: readonly AnnouncementId[]): boolean =>
  crossed.some((id) => isOneOf(id, BOARD_IDS))

// ─── Other players' records ────────────────────────────────────────────────────

export type Leader = { score: number; userId: string; nickname: string | null }
export type Leaders = Record<Period, Leader | null>

export const NO_LEADERS: Leaders = { today: null, week: null, ever: null }

// What another player just did to the boards, or null if nothing worth announcing.
//
// Compares two snapshots rather than reading a Realtime payload, so it cannot be
// fooled by a partial row and needs no second lookup for the name. Losing a record you
// held outranks merely watching the bar go up, and within each the biggest period wins.
export function rivalChange(
  before: Leaders,
  after: Leaders,
  myUserId: string | null,
): { id: AnnouncementId; name: string } | null {
  const taken = PERIODS.flatMap((period) => {
    const was = before[period]
    const now = after[period]
    // No baseline yet, or the board is still empty: nothing was taken from anyone.
    if (was === null || now === null) return []
    // Your own new record is announced by the run, not by this.
    if (myUserId !== null && now.userId === myUserId) return []
    if (now.score <= was.score) return []
    return [{ period, mine: myUserId !== null && was.userId === myUserId, now }]
  })

  const lost = taken.find((change) => change.mine)
  const chosen = lost ?? taken[0]
  if (chosen === undefined) return null

  return {
    id: chosen.mine ? LOST_ID[chosen.period] : RAISED_ID[chosen.period],
    name: displayName(chosen.now.nickname),
  }
}
