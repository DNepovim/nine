import type { AchievementId } from '@/constants/achievements'
import { earned, type AchievementFacts, type RunFacts } from '@/lib/achievements'
import { emptyCareer, type Career } from '@/lib/career'
import type { HitInfo } from '@/machines/game'

// What a run has earned, and what it has already been told.
//
// Pure on purpose, and for the same reason `lib/announcement-run.ts` is: every bug the
// announcement bar has had was a question of *when* a value was read, not of what the
// comparison said. Timing written as effects is timing nobody can test; written as a step
// function it is four rules and a table of cases.
//
// The career is frozen as the run begins. It has to be: the run is folded into the career
// when it ends, so a live run measured against a total that already contains it would
// count its own hits twice. Every rule reads `career` as "before this run" and adds the
// run itself where it matters.
export type AchievementPhase = {
  started: boolean
  career: Career
  // Everything unlocked this run, so one achievement announces once however many hits
  // land past its bar.
  fired: readonly AchievementId[]
}

// The per-run figures no single snapshot can answer, accumulated batch by batch.
export type RunTally = {
  // Hits landed while the lives were still whole. A run *ends* because its lives ran out,
  // so "without losing a life" can only ever describe a stretch inside a run.
  cleanHits: number
  // Hits taken in exactly the optimal number of presses.
  parHits: number
  // The most presses any single landed hit took.
  longestRoute: number
}

export const EMPTY_TALLY: RunTally = { cleanHits: 0, parHits: 0, longestRoute: 0 }

// Folds one resolved hit batch into the run's tally.
//
// `totalHits` is the run's hit count *after* this batch, not the batch's size: the clean
// stretch is "how far the run had got", and re-deriving it from the count is what keeps it
// correct when a batch lands several targets at once.
export function foldBatch(
  tally: RunTally,
  {
    hits,
    totalHits,
    livesFull,
  }: { hits: readonly HitInfo[]; totalHits: number; livesFull: boolean },
): RunTally {
  return {
    cleanHits: livesFull ? Math.max(tally.cleanHits, totalHits) : tally.cleanHits,
    parHits: tally.parHits + hits.filter((hit) => hit.steps === hit.par).length,
    longestRoute: hits.reduce(
      (most, hit) => Math.max(most, hit.steps),
      tally.longestRoute,
    ),
  }
}

export type RunInput = {
  inRun: boolean
  // Whether the career has been read from storage yet. Freezing before it has means
  // freezing zeroes, and a lifetime total of zero unlocks THOUSAND HITS on the first hit
  // of the first run after a cold start — for a player who passed it months ago.
  ready: boolean
  // The live career. Copied into the phase at the moment of freezing and ignored after.
  career: Career
  // Everything else the rules ask about. The career is the phase's, not this.
  facts: Omit<AchievementFacts, 'career'>
  // What the player already holds, from the store. Filtered at evaluation rather than
  // seeded into `fired`, so a store that finishes loading mid-run still silences the
  // achievements it covers instead of announcing them a second time.
  held: readonly AchievementId[]
}

export type RunStep = {
  phase: AchievementPhase
  // Everything newly earned, in catalogue order. Empty for nothing new.
  unlocked: AchievementId[]
}

export const IDLE: AchievementPhase = {
  started: false,
  career: emptyCareer(),
  fired: [],
}

const QUIET: AchievementId[] = []

function evaluate(phase: AchievementPhase, input: RunInput): RunStep {
  const all = earned({ ...input.facts, career: phase.career })
  const fresh = all.filter((id) => !phase.fired.includes(id) && !input.held.includes(id))
  // Everything earned is marked, not just what is announced. An achievement the store
  // already covers is silent but still settled — otherwise it would be re-tested on every
  // hit for the rest of the run, and would speak up the moment the store said anything
  // different. Nothing in `fresh` can be missing from this, so a run with nothing new has
  // nothing to mark either, and the phase is handed back by identity.
  const fired = [...new Set([...phase.fired, ...all])]
  if (fired.length === phase.fired.length) return { phase, unlocked: QUIET }
  return { phase: { ...phase, fired }, unlocked: fresh }
}

// One step of a run's achievements. The rules, in order:
//
//   - not in a run       → back to idle, ready for the next one
//   - not ready yet      → freeze nothing
//   - ready, not started → freeze the career now, then measure what the run has *already*
//                          done, so a late read catches up rather than missing it
//   - started            → ignore the incoming career entirely
export function stepAchievements(phase: AchievementPhase, input: RunInput): RunStep {
  if (!input.inRun) return { phase: IDLE, unlocked: QUIET }
  if (phase.started) return evaluate(phase, input)
  if (!input.ready) return { phase, unlocked: QUIET }
  return evaluate({ started: true, career: input.career, fired: [] }, input)
}

// The run half of the facts, assembled from the machine's context and the tally.
//
// Here rather than in the hook so the shape has one definition and the tests can build a
// run without a React tree.
export function runFacts(
  run: Omit<RunFacts, 'cleanHits' | 'parHits' | 'longestRoute'>,
  tally: RunTally,
): RunFacts {
  return { ...run, ...tally }
}
