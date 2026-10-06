import { msg } from '@lingui/core/macro'

import { defineMode } from '@/modes/types'

// The way: one crossroad at a time, a choice of where to go next, and a depth instead of
// a score.
//
// The one mode on another engine. A run of it keeps no board, no lives and no streak, so
// it has nothing to say to the game machine — what it has instead is in machines/arcade.ts
// and hooks/use-arcade-run.ts. It is in the registry all the same, because the intro's
// pills, the gradients and the one-line descriptions are questions about *a mode*, and
// arcade was answering them from a table of its own until there was a registry to join.
export const ARCADE = defineMode({
  id: 'arcade',
  label: msg`ARCADE`,
  code: msg`ARC`,
  // Not the teaser's "levels, bonuses, sidequests" any more. The pill is playable behind
  // a flag now, and what is behind it is the way — so the line says what a run of it
  // actually asks, and the promises wait until they are built.
  description: msg`Climb the way, or fall back.`,
  gradient: ['#E5534B', '#FF8C00'],
  darkGradient: ['#620b0c', '#7A3800'],
  shot: null,
  window: null,
  engine: 'arcade',
})

// What the pill's corner says. Two badges, because it means two different things to two
// different readers: a player without the `arcade` flag sees a teaser for something that
// is not theirs yet, and a developer sees a door. See constants/features.ts.
export const ARCADE_TEASER = { tag: 'SOON', devTag: 'DEV' } as const
