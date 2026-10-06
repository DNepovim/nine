import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { VerdictKey } from '@/lib/compare'
import { idSeed, pickFrom, seeded } from '@/lib/rng'

// The sentence under the two names, and the only part of the comparison a person is meant
// to edit. `lib/compare.ts` decides which pool a table falls into; this file decides what
// the pool says.
//
// **No variant may name a player.** The recap's phrasings carry nicknames and pay for it in
// Czech, where `Mull3rm1x_` has no possessive — those lines carry the case on a noun beside
// the name instead. These lines sidestep the problem entirely by speaking in *you* and
// *they*: the table already prints both names twice the size of anything else, so a
// sentence repeating them would be telling the reader what they are looking at.
//
// Which also makes every line directional, and the direction is in the key. `routMine` is
// the reader doing the routing; `routTheirs` is the reader being routed. A pool written for
// one and used for the other would congratulate a player on a hiding.

// A resolved descriptor — `t` from `useLingui`, or an English resolver in a test. Passed in
// rather than imported so that choosing a line stays a pure function of the verdict and the
// seed.
export type Translate = (descriptor: MessageDescriptor) => string

const VERDICT_LINES = {
  // Five rows or more. Nothing a single evening is going to close, and the lines are
  // allowed to enjoy that — this is the one band where the table has actually settled
  // something.
  routMine: [
    msg`Not the same weight class. They are still finding the dial.`,
    msg`This is not a contest, it is a demonstration.`,
    msg`You took the room and left them the door.`,
    msg`They came to compare. You came to collect.`,
    msg`Every column leans your way. There is nothing here they hold.`,
    msg`A rout. Somebody should tell them where the keys are.`,
    msg`They have a career. You have a monopoly.`,
    msg`The gap is not a gap. It is a floor and a ceiling.`,
  ],
  routTheirs: [
    msg`You are being taken apart. Almost nothing here is yours.`,
    msg`They are not ahead of you, they are out of sight.`,
    msg`You are reading somebody else's trophy cabinet.`,
    msg`This one is over. The dial has been kinder to them.`,
    msg`They own this table. You are a guest on it.`,
    msg`There is a long climb in front of you, and they are at the top of it.`,
    msg`Not close, not nearly. Go and play.`,
    msg`Every row you lose here, you lost first on a board.`,
  ],
  // Two to four rows. A lead rather than a verdict, and every line is written to say so —
  // this is the band that is about to change, and the one a player should be told to go and
  // do something about.
  clearMine: [
    msg`You have the better of this, and they know it.`,
    msg`The table leans your way, but it is not nailed down.`,
    msg`Ahead on points, and holding.`,
    msg`More of this is yours than theirs. Not all of it.`,
    msg`You are up, with just enough left over for them to want.`,
    msg`A good lead. Leads have been lost from here.`,
    msg`You are winning, which is not the same as having won.`,
    msg`Comfortable. Comfort is how boards change hands.`,
  ],
  clearTheirs: [
    msg`They are ahead, but the gap has a bottom to it.`,
    msg`Behind, and within reach — two boards would do it.`,
    msg`They lead. Nothing about that is permanent.`,
    msg`You are down, not out. The dial is still there.`,
    msg`More of this is theirs. Not much more.`,
    msg`You have ground to make up and the runs to make it in.`,
    msg`Second, for now.`,
    msg`They are the better of you today. Today is one day.`,
  ],
  // One row. Kept directional for the obvious reason: whose whisker it is is the entire
  // content of the sentence.
  closeMine: [
    msg`A whisker in it, and the whisker is yours.`,
    msg`You lead by the width of one row.`,
    msg`Ahead by a hair — do not breathe out.`,
    msg`One row between you, and it has your name on it.`,
  ],
  closeTheirs: [
    msg`A whisker in it, and the whisker is theirs.`,
    msg`One row between you. One run would take it.`,
    msg`Behind by a hair. That is nothing.`,
    msg`They lead by the width of a single row.`,
  ],
  even: [
    msg`Nothing to choose between you.`,
    msg`Dead level. Somebody will have to go and play.`,
    msg`The table has no opinion. You will have to settle it on the dial.`,
    msg`Even. Perfectly, annoyingly even.`,
    msg`Row for row, hit for hit. Nobody takes this one.`,
    msg`A tie, which is the one result neither of you wanted.`,
  ],
  // Level because neither of you has started. Told apart from a real draw because being
  // told there is nothing to choose between two empty careers reads as a verdict on the
  // players rather than on the table.
  unplayed: [
    msg`Two careers, no scores. The dial is right there.`,
    msg`Nothing on the boards yet, for either of you.`,
    msg`An empty table. Somebody go first.`,
    msg`No runs, no records, no argument. Yet.`,
  ],
} as const satisfies Record<
  VerdictKey,
  readonly [MessageDescriptor, ...MessageDescriptor[]]
>

// The line this comparison is told in.
//
// Seeded rather than random, for the reason the recap is: a player who closes the table and
// opens it again should be told the same thing. The seed is the two players and the score
// between them, so the sentence only changes when something it describes has — a board taken
// overnight gives a new line, a second look at the same table does not.
export const verdictLine = (key: VerdictKey, seed: string, t: Translate): string =>
  t(pickFrom(seeded(idSeed(seed)), VERDICT_LINES[key]))
