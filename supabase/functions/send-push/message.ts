// The text of a push, in the subscriber's language. Built here rather than in the app
// because the app is not running when it is sent, so the Lingui catalog is out of reach;
// the words below are the catalog's own (ACCURACY, HARD, …) copied across, and
// message.test.ts is what keeps the two from being forgotten together.
//
// Pure and free of Deno or Node APIs so Vitest can read it — index.ts is the only file in
// this folder that knows where it runs.

export type PushLocale = 'en' | 'cs'

export type Takeover = {
  mode: string
  difficulty: string
  // Whole, ten characters at most, never cut: it is the one thing the push is about.
  byNickname: string
}

export type PushMessage = {
  title: string
  body: string
  // One notification per board: a second takeover of it replaces the first on the lock
  // screen instead of stacking.
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

const TITLE: Record<PushLocale, string> = {
  en: 'Your record is gone',
  cs: 'Rekord je pryč',
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
    title: TITLE[locale],
    body: BODY[locale](takeover.byNickname, `${mode}, ${difficulty}`),
    tag: `takeover-${takeover.mode}-${takeover.difficulty}`,
    url: '/',
  }
}
