import { FIRST_COMMAND } from '@/lib/terminal-log'

import type { OpeningTake } from './types'

// The `terminal` opening's beats in ms: how long before the first key, per key, and the beat
// for the Enter. Two things run off these and must agree to the frame — the scene, which holds
// the run for exactly this long, and the terminal board, which types the command meanwhile.
export const OPENING_BEATS = {
  full: { before: 900, perKey: 140, enter: 800 },
  short: { before: 150, perKey: 30, enter: 200 },
} as const satisfies Record<
  OpeningTake,
  { before: number; perKey: number; enter: number }
>

export const openingLength = (take: OpeningTake): number => {
  const { before, perKey, enter } = OPENING_BEATS[take]
  return before + perKey * FIRST_COMMAND.length + enter
}
