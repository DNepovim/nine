import { msg } from '@lingui/core/macro'

import { targetRules } from '@/modes/rules'
import { defineMode } from '@/modes/types'

// The clock. Every hit shortens the ring the next target gets, and a run of fast ones is
// what builds the multiplier.
export const SPEED = defineMode({
  id: 'speed',
  label: msg`SPEED`,
  code: msg`SPD`,
  description: msg`Fast hits build big combos.`,
  gradient: ['#c36282', '#E5534B'],
  darkGradient: ['#501b2e', '#620b0c'],
  shot: 'burst',
  window: null,
  engine: 'targets',
  rules: targetRules({
    // Accuracy's 22 000 / 1.5 — Speed runs half again as fast, not nearly three times,
    // which was more punishing than distinguishing.
    clock: { base: 14667, ramps: 'clock' },
    scoring: { weights: { acc: 0.15, spd: 0.85 }, streak: 'fast' },
  }),
})
