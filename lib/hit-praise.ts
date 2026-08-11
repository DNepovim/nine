import type { CleanReason } from '@/machines/scoring'

// What the confetti in Trainee is for. Without a line saying so, a learner sees
// a celebration and has to guess which half of the hit earned it — which is the
// one thing the mode exists to teach.
//
// Each line says what the player actually did, in as few words as it takes. It
// names no figure: the stat row directly above already shows the accuracy and
// speed of that hit, so repeating them here would spend the width saying twice
// what is already on screen. What the number does not say is what it *means* —
// that is this line's whole job.
//
// Sentence case rather than the app's usual shouting caps, matching the
// announcement bar: this is the game talking to you, not a label.
const PRAISE = {
  accuracy: ['No wasted moves', 'Shortest route', 'Fewest moves possible'],
  speed: ['Most of the clock left', 'Time to spare', 'Well ahead of the clock'],
  both: ['Shortest route, fast too', 'No waste, time to spare', 'Optimal and fast'],
} as const satisfies Record<CleanReason, readonly [string, ...string[]]>

export const praisePool = (reason: CleanReason): readonly string[] => PRAISE[reason]

// Which line to use, given a roll in [0, 1). The roll is a parameter rather than
// a Math.random() call inside, so the choice stays pure and testable and the
// randomness lives at the call site — the same shape as `messageFor`.
export function praiseFor(reason: CleanReason, roll: number): string {
  const pool = PRAISE[reason]
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index] ?? pool[0]
}
