import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { StreakTrigger } from '@/modes'

// What builds a strike, in one sentence, for the screen that has to say so before the
// player has pressed anything.
//
// A challenge is met once and cold — a dial, a clock and a scoring rule the player has
// never seen — and the multiplier is the one part of it that cannot be worked out by
// looking at the board. Every permanent mode's rule is written out in How to Play, under
// the mode's own card; a challenge has no card there and cannot have one, since what it
// changes is different every time. So the rule is printed in the dialog instead.
//
// Keyed on the **trigger** rather than on the mode, for the reason `EMPTY_LINES` is keyed
// on the headline: this is not a mode table living outside modes/. A challenge inherits
// whichever rule its rules resolved to, and a new challenge needs nothing added here
// unless it brings a trigger nobody has written a line for.
//
// `none` is null rather than a sentence. A mode with no streak has nothing to explain,
// and "there are no strikes here" is a line about an absence — the dialog simply leaves
// the row out.
const STRIKE_LINES = {
  optimal: msg`Take every target in the fewest moves it can be done in.`,
  fast: msg`Take every target while most of its ring is still full.`,
  clear: msg`Leave the board empty — clear every target standing on it.`,
  whole: msg`Move every key on the dial on the way to the target.`,
  spread: msg`Move at least one key in every row of the dial.`,
  none: null,
} as const satisfies Record<StreakTrigger, MessageDescriptor | null>

// The line for a run's streak rule, or null where the rule is that there is none.
export const strikeRuleOf = (streak: StreakTrigger): MessageDescriptor | null =>
  STRIKE_LINES[streak]
