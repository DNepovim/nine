import { msg } from '@lingui/core/macro'

import { targetRules } from '@/modes/rules'
import { defineMode } from '@/modes/types'

// Practice. No lives, no rung to pick, and the one clock in the app that is not part of
// the test — Trainee is where the weights get learned, and a route worked out with time
// to spare teaches more than one found in a hurry.
export const TRAINEE = defineMode({
  id: 'trainee',
  label: msg`TRAINEE`,
  description: msg`No lives, no rush.`,
  gradient: ['#4C7EFF', '#7273D2'],
  darkGradient: ['#102972', '#27255a'],
  // Nothing is fired. Practice's streak is the legacy board-clear rule rather than a
  // chain of decisions, and the sum's answering ring is the whole event there.
  shot: null,
  window: null,
  engine: 'targets',
  rules: targetRules({
    // Pinned to Easy and so showing no difficulty row: a mode with no lives and a clock
    // the player sets has nothing left for a rung to tighten.
    fixedDifficulty: 'easy',
    clock: {
      // Double Accuracy's. At the Easy pace it always runs at, that is a little over a
      // minute on each target.
      base: 44000,
      // Settable from the pause screen — the one place where the clock is the player's
      // to choose rather than the thing being tested.
      playerSet: true,
    },
    spawn: {
      // The gap follows the clock, being a third of it — up to a point. At this length a
      // third would be twenty seconds of empty board while the player sits on a route
      // they worked out in five, so the gap holds here instead: the long ring buys time
      // on the target, and the board stays as busy as any other mode's.
      //
      // Seven seconds is exactly a third of twenty-one, so the two rules meet rather
      // than step — under a 21-second clock the gap is still a third of it, over one it
      // holds here.
      cap: 7000,
    },
    // Two thirds on the route, which is what practice is for. No headline to go with
    // it: nothing reports a factor here, because both screens that show one are behind
    // `scored` and this mode keeps no board.
    scoring: { weights: { acc: 2 / 3, spd: 1 / 3 } },
    // No life is ever lost, so nothing ends a practice run but the player.
    lives: { count: Number.POSITIVE_INFINITY, expiryCostsLife: false },
    // Unscored, so no leaderboard, no rank, no medal and no personal best — and it
    // teaches, so it gets the stat block, the coach and the hints on the keys.
    capabilities: { scored: false, coached: true, keyHints: true },
  }),
})
