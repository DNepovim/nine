import { z } from 'zod'

import { TUTORIAL_STEP_COUNT } from '@/constants/tutorial'

// What survives a visit to the tutorial: one bit, saying the player has been through it.
//
// It used to be two — the flag and the screen a half-finished first launch stopped on —
// because the tutorial opened itself the moment the splash cleared and had to be able to
// pick up where it left off. It does not open itself any more (see lib/welcome.ts), so
// there is no interrupted run to resume: every visit starts from How to Play, and starts
// at the beginning.
const doneSchema = z.object({ finished: z.boolean().optional() })

export const clampStep = (step: number): number =>
  Math.min(Math.max(Math.trunc(step), 0), TUTORIAL_STEP_COUNT - 1)

function safeJson(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw)
    return value
  } catch {
    return null
  }
}

// Anything unreadable degrades to "not been through it", which costs the player nothing
// they can see: the only thing hanging off this flag is an achievement, and the guide is
// on the same shelf either way.
export function parseTutorialDone(raw: string | null): boolean {
  if (raw === null) return false
  const parsed = doneSchema.safeParse(safeJson(raw))
  if (!parsed.success) return false
  return parsed.data.finished === true
}

export function serializeTutorialDone(done: boolean): string {
  return JSON.stringify({ finished: done })
}
