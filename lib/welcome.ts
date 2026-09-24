import { z } from 'zod'

import type { Difficulty, Mode } from '@/machines/game'

// The first launch, and what the device remembers about it.
//
// A player who opens the app for the first time does not get a guide across their screen
// — they get a Trainee run already going, with the coach's hints teaching in place of the
// lesson they would have read. The tutorial is still there, one press away in How to
// Play; it just no longer takes the opening for itself.
//
// The stored flag outlives that one run. It is the second thing this file is for: a
// player welcomed this way has never seen a scored board, so Trainee keeps offering them
// one — on hit count alone, in every practice run, until they take it. See
// `fromWelcome` in lib/step-up.ts.

// The board a first launch opens on, named here rather than left to the machine, whose
// own default context is Accuracy Hard. Somebody who has never played gets practice with
// unlimited lives and the gentlest clock — the same reasoning behind STEP_UP_BOARD's
// Easy: the one board you can be dropped onto without having been told anything first.
export const WELCOME_BOARD = { mode: 'trainee', difficulty: 'easy' } as const satisfies {
  mode: Mode
  difficulty: Difficulty
}

const welcomeSchema = z.object({ welcomed: z.boolean().optional() })

// `welcomed` is not "has the welcome happened" — the key being there at all answers that.
// It is "did this install open with the welcome run", which is the half that still
// matters a week later.
export type Welcome = { welcomed: boolean }

export const WELCOMED: Welcome = { welcomed: true }
export const NOT_WELCOMED: Welcome = { welcomed: false }

function safeJson(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw)
    return value
  } catch {
    return null
  }
}

// `null` for a device that has never answered the question — which is also where anything
// unreadable lands. A corrupt value costs at most one extra welcome, and only on a device
// with no history at all: `welcomeLaunch` asks that separately.
export function parseWelcome(raw: string | null): Welcome | null {
  if (raw === null) return null
  const parsed = welcomeSchema.safeParse(safeJson(raw))
  if (!parsed.success) return null
  return { welcomed: parsed.data.welcomed === true }
}

export function serializeWelcome(welcome: Welcome): string {
  return JSON.stringify(welcome)
}

export type WelcomeLaunch = 'start' | 'skip'

// What this launch does: open into a Trainee run, or leave the player on the intro.
//
// `hasHistory` is the guard for everyone who was already playing before any of this
// existed. Their device has no welcome flag either, and without the second question they
// would be yanked out of the intro and into a practice run they never asked for.
export function welcomeLaunch(
  stored: Welcome | null,
  hasHistory: boolean,
): WelcomeLaunch {
  if (stored !== null) return 'skip'
  return hasHistory ? 'skip' : 'start'
}
