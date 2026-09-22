import { awardKey, earned, type AchievementFacts, type Award } from '@/lib/achievements'
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
  // Every award unlocked this run, as `awardKey` names it, so one stage announces once
  // land past its bar.
  fired: readonly string[]
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
  // What the player already holds, from the store, as `awardKey` names it. Filtered at
  // evaluation rather than seeded into `fired`, so a store that finishes loading mid-run
  // still silences the awards it covers instead of announcing them a second time.
  held: readonly string[]
}

export type RunStep = {
  phase: AchievementPhase
  // Every award newly earned, in catalogue order. Empty for nothing new.
  unlocked: Award[]
}

export const IDLE: AchievementPhase = {
  started: false,
  career: emptyCareer(),
  fired: [],
}

const QUIET: Award[] = []

function evaluate(phase: AchievementPhase, input: RunInput): RunStep {
  const all = earned({ ...input.facts, career: phase.career })
  const fresh = all.filter((award) => {
    const key = awardKey(award)
    return !phase.fired.includes(key) && !input.held.includes(key)
  })
  // Everything earned is marked, not just what is announced. An achievement the store
  // already covers is silent but still settled — otherwise it would be re-tested on every
  // hit for the rest of the run, and would speak up the moment the store said anything
  // different. Nothing in `fresh` can be missing from this, so a run with nothing new has
  // nothing to mark either, and the phase is handed back by identity.
  const fired = [...new Set([...phase.fired, ...all.map(awardKey)])]
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

// ── What is still waiting for the announcement bar ───────────────────────────

// An award belongs to the run it was unlocked in, and the bar is a mid-run thing. GOOSE
// EGG is the clearest case: it can only be answered by the pass made at game over, when
// the bar is already gone, so it is a leftover the instant it exists — and the game-over
// screen has paid it out by the time the player sees it anyway.
//
// The run boundary lives in the value rather than in an effect, and for the same reason
// the rest of this file is pure. The queue is written by the achievements and read by the
// bar, two effects in the same commit: clearing it in a third only *schedules* the clear,
// so on the one commit where a run begins the bar still read the render it was given —
// the last run's leftovers — and put one of them up. Stepped on every read and every
// write, there is no commit where the two can disagree.
export type AwardQueue = {
  // Whether a run was on when the queue was last written.
  inRun: boolean
  waiting: readonly Award[]
}

// Shared so that a queue stepped twice hands back the same empty array, and an effect
// keyed on it does not re-run for every render of a run with nothing waiting.
const NOTHING: readonly Award[] = []

export const EMPTY_QUEUE: AwardQueue = { inRun: false, waiting: NOTHING }

// The queue as of now. A run beginning empties it; a run ending leaves it alone, since
// nothing can reach the bar again until the next one starts.
export function stepQueue(queue: AwardQueue, inRun: boolean): AwardQueue {
  if (queue.inRun === inRun) return queue
  return { inRun, waiting: inRun ? NOTHING : queue.waiting }
}

// Adds what a step just unlocked, oldest first.
export const queueAwards = (queue: AwardQueue, awards: readonly Award[]): AwardQueue => ({
  ...queue,
  waiting: [...queue.waiting, ...awards],
})

// Drops one that has had its turn.
export const dropAward = (queue: AwardQueue, award: Award): AwardQueue => {
  const key = awardKey(award)
  return { ...queue, waiting: queue.waiting.filter((held) => awardKey(held) !== key) }
}
