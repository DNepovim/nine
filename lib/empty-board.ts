import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { LeaderboardTab } from '@/lib/leaderboard-period'
import type { Difficulty, Headline } from '@/modes'

// What a board says when nothing is on it.
//
// One line per board × period, and the line is written for that board: the period sets
// the span it mourns — a day is a shrug, forever is a claim nobody has ever made — the
// difficulty sets the register, and the mode supplies the verb. Accuracy's empty boards
// talk about the route not walked; Speed's talk about the clock nobody beat.
//
// Keyed on the mode's **headline** rather than its name, so this is not a mode table
// living outside modes/: a challenge scored on accuracy inherits accuracy's voice the
// day it opens, and nothing here has to be edited for it. See `headlineOf`.
const EMPTY_LINES = {
  acc: {
    easy: {
      today: msg`— NO SHORT ROUTE TODAY —`,
      week: msg`— NO SHORT ROUTE THIS WEEK —`,
      forever: msg`— THE SHORT ROUTE IS UNWALKED —`,
    },
    hard: {
      today: msg`— NOBODY WAS EXACT TODAY —`,
      week: msg`— THE WEEK HAS NO EXACT HAND —`,
      forever: msg`— NO ONE HAS DIALLED IT CLEAN —`,
    },
    extreme: {
      today: msg`— TODAY TOOK NO NAMES —`,
      week: msg`— A WEEK, NOT ONE CLEAN RUN —`,
      forever: msg`— NEVER ONCE DIALLED CLEAN —`,
    },
  },
  spd: {
    easy: {
      today: msg`— NOBODY BEAT THE CLOCK TODAY —`,
      week: msg`— THE CLOCK WON ALL WEEK —`,
      forever: msg`— THE CLOCK IS STILL UNBEATEN —`,
    },
    hard: {
      today: msg`— NO ONE WAS QUICK TODAY —`,
      week: msg`— A QUIET WEEK FOR THE QUICK —`,
      forever: msg`— NOTHING HAS OUTRUN THIS YET —`,
    },
    extreme: {
      today: msg`— TODAY, NOBODY WAS FAST ENOUGH —`,
      week: msg`— NOT ONE FAST ENOUGH THIS WEEK —`,
      forever: msg`— NEVER ONCE FAST ENOUGH —`,
    },
  },
} as const satisfies Record<
  Headline,
  Record<Difficulty, Record<LeaderboardTab, MessageDescriptor>>
>

// The line for one empty period of one board. Always answers: every combination is
// written out above, and the type is what says so.
export const emptyBoardLine = (
  headline: Headline,
  difficulty: Difficulty,
  tab: LeaderboardTab,
): MessageDescriptor => EMPTY_LINES[headline][difficulty][tab]
