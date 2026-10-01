import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { MODE_ORDER } from '.'

// The claim this whole package exists to make: the engine does not know which modes
// there are.
//
// Asserted rather than described, because it is the thing that decays first. Every rule a
// mode could bend used to be a column in one table, and every rule it could not was a
// branch somewhere reading `mode === 'trainee'` — and the next such branch is one line to
// write and invisible in review. A mode registered this morning has to run correctly on a
// build compiled last week, which it cannot do if the engine is still asking for a name.
//
// What is allowed: naming a mode as a *default* or a *fallback* — the mode a fresh install
// opens on, the rules a run falls back to when its own cannot be resolved. Those are
// choices about where to start, not rules about how to play.
const ENGINE = [
  'machines/game.ts',
  'machines/scoring.ts',
  'machines/coach.ts',
  'hooks/use-target-spawner.ts',
  'hooks/use-trainee-coach.ts',
  'components/game/dial.tsx',
  'lib/dial-gesture.ts',
  'lib/dial-metrics.ts',
]

// Code only. The prose says "Trainee" and "Speed" constantly, and has to: a comment
// explaining why Accuracy's clock holds still is worth more than one that will not say so.
const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => {
      const start = line.trimStart()
      return !start.startsWith('//') && !start.startsWith('*') && !start.startsWith('/*')
    })
    .join('\n')

describe('the engine names no mode', () => {
  it('compares nothing against a mode name', () => {
    for (const path of ENGINE) {
      for (const mode of [...MODE_ORDER, 'arcade']) {
        expect(code(path), `${path} compares against '${mode}'`).not.toMatch(
          new RegExp(`[=!]==\\s*'${mode}'`),
        )
      }
    }
  })

  it('indexes no table by a mode', () => {
    // `MODES[mode]`, which is what the registry replaced. A table keyed by every mode
    // there is cannot hold one registered after it was written.
    for (const path of ENGINE) {
      expect(code(path), path).not.toMatch(/MODES\[/)
      expect(code(path), path).not.toMatch(/\bMODE_[A-Z_]+\[/)
    }
  })

  it('reads the dial off the rules rather than assuming nine keys', () => {
    // Every one of these was a literal 3 or 9 before the dial became a value.
    for (const path of ENGINE) {
      expect(code(path), `${path} splits an index by a hard-coded row width`).not.toMatch(
        /(Math\.floor\([^)]*\/\s*3\)|index\s*%\s*3)/,
      )
    }
  })
})
