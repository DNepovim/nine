import { msg } from '@lingui/core/macro'

import { SPEED } from '@/modes/definitions/speed'
import { defineDial } from '@/modes/dial'
import type { ModeDefinition } from '@/modes/types'

import { defineChallenge } from './define'

// Every challenge the app has ever carried, each with the window it ran in.
//
// A list rather than only the live ones, and nothing is deleted from it. A challenge's
// window closes but its id does not stop existing: a stored run, a stat row and a
// player's history all still name it, and a mode nothing is registered under reads to
// all three as corrupt rather than as over. So an expired challenge stays here, out of
// every list the player sees (see `isOpenMode`) and still answerable by name.
//
// Hand-written for now. The windows are absolute timestamps, so the natural next step is
// for this list to be fetched rather than compiled in — the rest of the package does not
// care which, since a challenge reaches the registry as a `ModeDefinition` either way.
// What that will need first is on the server, not here: `scores.mode` is a text column
// with a `check (mode in ('accuracy', 'speed'))` on it, so no challenge can keep a
// published board until that check is widened.

const HOUR = 3600_000
const DAY = 24 * HOUR

// The worked example, and the only one: Speed on a dial of four coarse keys, where every
// press moves the sum a long way and the fine trim nobody gets is the whole difficulty.
//
// Its window has closed, so it is in no list the player sees. It is kept because it is
// the thing to copy — every group a challenge may bend is bent in it exactly once — and
// because the tests walk it.
const FOUR_KEYS = defineChallenge({
  slug: 'four-keys',
  label: msg`FOUR KEYS`,
  description: msg`Four coarse keys. No room to trim.`,
  base: SPEED,
  from: Date.UTC(2026, 8, 1),
  until: Date.UTC(2026, 8, 1) + DAY,
  rules: {
    dial: defineDial({ id: 'four-keys', rows: 2, cols: 2, weights: [3, 6, 9, 12] }),
    clock: { base: 18000 },
    spawn: { maxTargets: 2 },
    scoring: { streak: 'clear', base: 150 },
    lives: { count: 2 },
  },
})

export const CHALLENGES: readonly ModeDefinition[] = [FOUR_KEYS]
