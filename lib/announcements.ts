// Announcements take over the best-scores bar for a moment when something worth
// saying happens mid-run. Each one has its own message and its own celebration —
// see components/game/announcement-effect.tsx.
export type AnnouncementId = 'record' | 'today' | 'week' | 'ever'

export type Announcement = { id: AnnouncementId; message: string }

// A pool per record, drawn from at random, so the same milestone does not always
// greet you with the same line.
//
// Every line is deliberately mode-neutral: these fire in Accuracy as well as Speed, so
// nothing may claim the player was *fast*. The lightspeed animation carries that
// flavour on its own; the words only say what was achieved.
const ANNOUNCEMENT_MESSAGES = {
  record: ['YOU BEAT YOUR BEST', 'A BETTER YOU', 'YOUR BEST YET', 'A NEW PERSONAL BEST'],
  today: ['TODAY BELONGS TO YOU', 'CROWNED FOR TODAY', 'FIRST TODAY', "TODAY'S BEST"],
  week: [
    'THE WEEK IS YOURS',
    'CROWNED FOR THE WEEK',
    'FIRST THIS WEEK',
    'UNBEATEN THIS WEEK',
  ],
  ever: [
    'NOBODY HAS SCORED HIGHER',
    'CROWNED OF ALL TIME',
    'FIRST OF ALL TIME',
    'UNTOUCHABLE',
  ],
} as const satisfies Record<AnnouncementId, readonly [string, ...string[]]>

// The longest line the bar can hold without truncating at 9px mono.
export const MAX_MESSAGE_LENGTH = 26

// Which line to use, given a roll in [0, 1). The roll is a parameter rather than a
// Math.random() call inside, so the choice stays pure and testable and the randomness
// lives at the call site.
export function messageFor(id: AnnouncementId, roll: number): string {
  const pool = ANNOUNCEMENT_MESSAGES[id]
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index] ?? pool[0]
}

export const announcementFor = (id: AnnouncementId, roll: number): Announcement => ({
  id,
  message: messageFor(id, roll),
})

export const messagePool = (id: AnnouncementId): readonly string[] =>
  ANNOUNCEMENT_MESSAGES[id]

// Biggest first, so a single hit that clears several records at once announces only
// the one worth shouting about.
const TIERS = ['ever', 'week', 'today', 'record'] as const

export type RecordTargets = {
  // The player's own stored best as the run began.
  record: number
  // Board records. Null means unknown — offline, or a board with no scores yet —
  // and an unknown record cannot be beaten.
  today: number | null
  week: number | null
  ever: number | null
}

// A record is only broken when there was one to beat: a first score sets the bar
// rather than breaking it, and equalling it is not beating it.
const beaten = (score: number, target: number | null): boolean =>
  target !== null && target > 0 && score > target

// Every record this score has passed, biggest first.
export function crossedRecords(score: number, targets: RecordTargets): AnnouncementId[] {
  return TIERS.filter((tier) => beaten(score, targets[tier]))
}
