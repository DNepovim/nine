// The text of a push, in the subscriber's language. Built here rather than in the app
// because the app is not running when it is sent, so the Lingui catalog is out of reach;
// the words below are the catalog's own (ACCURACY, HARD, …) copied across, and
// message.test.ts is what keeps the two from being forgotten together.
//
// Pure and free of Deno or Node APIs so Vitest can read it — index.ts is the only file in
// this folder that knows where it runs.

export type PushLocale = 'en' | 'cs'

type Period = 'day' | 'week' | 'ever'

export type Takeover = {
  mode: string
  difficulty: string
  period: Period
  // Whole, ten characters at most, never cut: it is the one thing the push is about.
  byNickname: string
}

// A session board's lead passed. `challenge` is the id the session stores, prefix and all.
export type Passed = {
  challenge: string
  byNickname: string
}

export type PushMessage = {
  title: string
  body: string
  // One notification per board and period: a second takeover of it replaces the first on
  // the lock screen instead of stacking, while losing the day and the week stay two.
  tag: string
  url: string
}

const MODES: Record<PushLocale, Record<string, string>> = {
  en: { accuracy: 'ACCURACY', speed: 'SPEED' },
  cs: { accuracy: 'PŘESNOST', speed: 'RYCHLOST' },
}

const DIFFICULTIES: Record<PushLocale, Record<string, string>> = {
  en: { easy: 'EASY', hard: 'HARD', extreme: 'EXTREME' },
  cs: { easy: 'LEHKÁ', hard: 'TĚŽKÁ', extreme: 'EXTRÉMNÍ' },
}

// The window the board was lost in, said in the title: a daily record is a smaller loss than
// the all-time one and the player should be able to tell which from the lock screen.
const TITLE: Record<PushLocale, Record<Period, string>> = {
  en: {
    day: 'Your daily record is gone',
    week: 'Your weekly record is gone',
    ever: 'Your all-time record is gone',
  },
  cs: {
    day: 'Denní rekord je pryč',
    week: 'Týdenní rekord je pryč',
    ever: 'Rekord všech dob je pryč',
  },
}

// The challenges, by slug — what `catalog.ts` calls them, copied across the way MODES and
// DIFFICULTIES are. A challenge's id arrives as `challenge/<slug>`; the soft hyphens the
// catalog keeps for narrow screens are left out, since a notification wraps itself.
// message.test.ts fails when the catalog has a slug this table lacks.
export const CHALLENGES: Record<PushLocale, Record<string, string>> = {
  en: {
    'four-keys': 'SQUARED',
    'four-by-four': 'MOSAIC',
    habit: 'CHA CHA',
    glimpse: 'STORM',
    'no-slip': 'NO SLIP',
    sideways: 'SIDEWAYS',
    drift: 'LAVA',
    'one-key': 'LIFTOFF',
    scramble: 'REELS',
    freeze: 'FREEZE',
    binary: 'BINARY',
    mirror: 'MIRROR',
    blackout: 'BLACKOUT',
  },
  cs: {
    'four-keys': 'ČTVEREC',
    'four-by-four': 'MOZAIKA',
    habit: 'CHA CHA',
    glimpse: 'BOUŘE',
    'no-slip': 'BEZ CHYBY',
    sideways: 'NA BOK',
    drift: 'LÁVA',
    'one-key': 'VZLET',
    scramble: 'VÁLCE',
    freeze: 'MRÁZ',
    binary: 'DVOJKOVĚ',
    mirror: 'ZRCADLO',
    blackout: 'TMA',
  },
}

const PASSED_TITLE: Record<PushLocale, string> = {
  en: 'You lost the lead',
  cs: 'Přišel jsi o vedení',
}

// Czech worded so as not to guess the other player's gender: the nickname is all there is.
const PASSED_BODY: Record<PushLocale, (who: string, challenge: string) => string> = {
  en: (who, challenge) => `${who} passed you in ${challenge}.`,
  cs: (who, challenge) => `${who} je ve výzvě ${challenge} před tebou.`,
}

const BODY: Record<PushLocale, (who: string, board: string) => string> = {
  en: (who, board) => `${who} took your record — ${board}.`,
  cs: (who, board) => `${who} ti vzal rekord — ${board}.`,
}

export function takeoverMessage(locale: PushLocale, takeover: Takeover): PushMessage {
  // An id the app does not know yet is shown as it came rather than dropped, so a mode
  // added later still reads as a board until this table catches up.
  const mode = MODES[locale][takeover.mode] ?? takeover.mode.toUpperCase()
  const difficulty =
    DIFFICULTIES[locale][takeover.difficulty] ?? takeover.difficulty.toUpperCase()
  return {
    title: TITLE[locale][takeover.period],
    body: BODY[locale](takeover.byNickname, `${mode}, ${difficulty}`),
    tag: `takeover-${takeover.mode}-${takeover.difficulty}-${takeover.period}`,
    url: '/',
  }
}

const CHALLENGE_PREFIX = 'challenge/'

export function passedMessage(locale: PushLocale, passed: Passed): PushMessage {
  const slug = passed.challenge.startsWith(CHALLENGE_PREFIX)
    ? passed.challenge.slice(CHALLENGE_PREFIX.length)
    : passed.challenge
  // As with a mode: an id this table has no word for is shown as it came.
  const challenge = CHALLENGES[locale][slug] ?? slug.toUpperCase()
  return {
    title: PASSED_TITLE[locale],
    body: PASSED_BODY[locale](passed.byNickname, challenge),
    tag: `passed-${slug}`,
    url: '/',
  }
}
