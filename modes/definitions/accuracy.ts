import { msg } from '@lingui/core/macro'

import { targetRules } from '@/modes/rules'
import { defineMode } from '@/modes/types'

// Precision. The clock stays where it is — deliberation is the thing this mode asks for,
// and hurrying it would undo that — so the run tightens by targets arriving closer
// together instead, and a hit dialled wastefully costs a life.
export const ACCURACY = defineMode({
  id: 'accuracy',
  label: msg`ACCURACY`,
  description: msg`Precision over speed.`,
  gradient: ['#7273D2', '#c36282'],
  darkGradient: ['#27255a', '#501b2e'],
  shot: 'sniper',
  window: null,
  engine: 'targets',
  rules: targetRules({
    clock: { ramps: 'spawn' },
    scoring: { weights: { acc: 0.85, spd: 0.15 }, streak: 'optimal' },
    lives: { wastefulCostsLife: true },
  }),
})
