# Freeze — Plan

Spec: docs/work/2026-11-02-freeze/spec.md

## Tasks

- [x] 1. `docs/domain.md`, `CLAUDE.md`: the **freeze** row, after **scramble**
- [x] 2. `modes/dial.ts`: `DialSpec.freeze`, `freeze = false` on `defineDial`; `modes/dial.test.ts` covers it. `hooks/use-held-sum.ts`
- [x] 3. `app/(tabs)/index.tsx`: the sum row's digits, `valueProgress` and `useScoreDirection` read `useHeldSum(sum, { freeze: dial.freeze, key: runId:hitSeq })`; the spawner keeps `sum`
- [x] 4. `modes/challenges/catalog.ts`: FREEZE appended; `challenges.test.ts` covers criteria 1–3
- [x] 5. `pnpm i18n:extract`, Czech (`MRÁZ`, `MRZ`, `Součet se pohne, jen když trefíš.`), `pnpm check`

## Build notes

- **Restore, checked.** `RESTORE` puts back the saved run's own `runId` (a fresh one only
  for a save that had none), not a new one as the spec says. The key still changes: the intro's
  key is a different run's id, so the row takes the restored grid's sum (criterion 7 holds).
  Spec's wording is loose, behaviour is as specified.
- **Hook test.** None, per spec: `useHeldSum` is a few lines of React state.
- **Shared tree.** `index.tsx` also carries another session's uncommitted strike-shot work
  (board origin read off the sum row), as do `lib/strike-shot.ts`,
  `components/game/strike-shot.tsx`, `constants/colors.ts`, `global.css` and
  `lib/name-gradient.test.ts`. Not this item's; `ship` must commit only this item's hunks.
- Dev data: none needed.

## Verification log

**Round 1, in progress.** Suite green (lint, Prettier, types, Knip, 2 111 tests, i18n 934/934).
Waiting on the browser for 4–9: the DevTools MCP's Chrome was held by another process.

| #   | Criterion                            | Result  | Evidence                                                                                         |
| --- | ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------ |
| 1   | Only FREEZE's dial freezes           | PASS    | `dial.test.ts`; `challenges.test.ts` › freeze, over `allModes()`                                 |
| 2   | `runRules` resolves as specified     | PASS    | `challenges.test.ts` › freeze                                                                    |
| 3   | Sniper, claims, last in `CHALLENGES` | PASS    | `challenges.test.ts` › freeze and the pinned order                                               |
| 4–9 | In-app                               | pending | scratch hook test (hold, jump, retake on a new run id, live when off) passed; app not yet driven |
| 10  | `pnpm check` green, Czech            | PASS    | `pnpm check`; `MRÁZ`, `MRZ`, `Součet se pohne, jen když trefíš.`                                 |
| 11  | **freeze** rows                      | PASS    | `docs/domain.md`, `CLAUDE.md`                                                                    |
