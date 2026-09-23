import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { BadgeCorner } from '@/components/game/dial-badge'
import { effectiveTimeout } from '@/machines/modes'

// The four numbers Trainee can print around a dial key.
//
// They are one lesson told four ways. The weight is what a single step on the key is
// worth; the ceiling is the most the key can ever give; and the two that move — what it
// is giving now, and what it could still add — always sum to that ceiling. A player who
// watches those two trade against each other has learned the whole of what a key does.
//
// Trainee only. The rest of the game is the same arithmetic done from memory, which is
// the point of practising it here.
export const DIAL_HINTS = ['weight', 'ceiling', 'giving', 'room'] as const

export type DialHint = (typeof DIAL_HINTS)[number]

// Named for what the number tells you, not for the arithmetic behind it — `GIVING NOW`
// rather than `VALUE × WEIGHT`, because a player reading these is the one who does not
// yet have the arithmetic by heart.
export const DIAL_HINT_LABEL = {
  weight: msg`WEIGHT`,
  room: msg`ROOM LEFT`,
  giving: msg`GIVING NOW`,
  ceiling: msg`CEILING`,
} as const satisfies Record<DialHint, MessageDescriptor>

// What a corner showing nothing says on its own tile. Not a hint — the absence of one.
export const NO_HINT_LABEL = msg`NOTHING`

// What sits where. The player picks per corner rather than per number, so the same
// number may be read in two places at once and another one nowhere at all: this is a
// dial to practise on, and somebody drilling the ceiling alone is entitled to see it
// twice. The four corners are independent by design, not by oversight.
export type DialCorners = Record<BadgeCorner, DialHint | null>

// Reading order for the picker's 2×2 grid, which lays its tiles out on the key's own
// plan — the tile you tap is where the number appears.
export const DIAL_CORNERS = [
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
] as const satisfies readonly BadgeCorner[]

// Every tile that offers one of these stands this tall — the four on the pause screen
// and the rows of the dialog they open. The number comes from the tallest thing any of
// them holds, a 28pt checkbox with its padding, and is shared so the two never drift.
export const HINT_TILE_HEIGHT = 48

// What the Trainee clock slider offers, in ms. Both ends are read off the mode table
// rather than typed in, so they follow the game's own tuning instead of drifting from it.
//
// The floor is the hardest clock the game asks anyone to play: a Speed target on Extreme,
// at the start of a run before the ramp has taken anything off it. Nothing in Trainee
// should be tighter than the tightest real thing.
//
// The ceiling is twice the most forgiving one — Accuracy on Easy — which is exactly where
// Trainee's own clock sits, so an untouched slider rests against its top end.
export const TRAINEE_TIMEOUT_MIN_MS = effectiveTimeout('speed', 'extreme')
export const TRAINEE_TIMEOUT_MAX_MS = 2 * effectiveTimeout('accuracy', 'easy')
// Whole seconds in the middle; the two ends are reachable exactly, being clamped to.
export const TRAINEE_TIMEOUT_STEP_MS = 1000

// Which corner, in words, for the dialog that sets one. Said plainly rather than as
// a direction — the dot grid beside the title is what points, and this names.
export const DIAL_CORNER_LABEL = {
  topLeft: msg`TOP LEFT`,
  topRight: msg`TOP RIGHT`,
  bottomLeft: msg`BOTTOM LEFT`,
  bottomRight: msg`BOTTOM RIGHT`,
} as const satisfies Record<BadgeCorner, MessageDescriptor>

// What Trainee has always printed: the weight up at the corner the key is labelled
// from, the ceiling down on the corner its value climbs toward. The other two start
// empty — four numbers on every key is a lot to meet unannounced, and a player who
// wants them is one pause away from them.
export const DEFAULT_DIAL_CORNERS = {
  topLeft: 'weight',
  topRight: null,
  bottomLeft: null,
  bottomRight: 'ceiling',
} as const satisfies DialCorners
