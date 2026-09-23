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
  // The run this phase belongs to, as the machine numbers them. The one thing that can
  // tell two runs apart from out here: `inRun` covers game over too — the finished pass
  // needs it to — and PLAY AGAIN goes straight from there back into playing, so it never
  // falls between two runs. A phase that waited for it kept the first run's frozen
  // career and its list of what had already fired for every run after.
  runSeq: number
  career: Career
  // Every award unlocked this run, as `awardKey` names it, so one stage announces once
  // land past its bar.
  fired: readonly string[]
}

// The per-run figures no single snapshot can answer, accumulated batch by batch.
export type RunTally = {
  // The run these figures belong to. Carried in the value rather than left to whoever
  // owns the tally, because "whoever owns the tally" is an effect and the run boundary
  // it has to clear on is invisible from out there — see `AchievementPhase.runSeq`. A
  // batch from a run this tally has never heard of starts it over, so the one thing that
  // can never happen is the thing that did: one run's par hits added to the next one's,
  // and PERFECT ROUTE paid out on a chain of runs rather than on a run.
  runSeq: number
  // Hits landed while the lives were still whole. A run *ends* because its lives ran out,
  // so "without losing a life" can only ever describe a stretch inside a run.
  cleanHits: number
  // Hits taken in exactly the optimal number of presses.
  parHits: number
  // The most presses any single landed hit took.
  longestRoute: number
}

export const EMPTY_TALLY: RunTally = {
  runSeq: -1,
  cleanHits: 0,
  parHits: 0,
  longestRoute: 0,
}

// Folds one resolved hit batch into the run's tally, starting over for a new run.
//
// `totalHits` is the run's hit count *after* this batch, not the batch's size: the clean
// stretch is "how far the run had got", and re-deriving it from the count is what keeps it
// correct when a batch lands several targets at once.
export function foldBatch(
  tally: RunTally,
  {
    runSeq,
    hits,
    totalHits,
    livesFull,
  }: {
    runSeq: number
    hits: readonly HitInfo[]
    totalHits: number
    livesFull: boolean
  },
): RunTally {
  const held = tally.runSeq === runSeq ? tally : EMPTY_TALLY
  return {
    runSeq,
    cleanHits: livesFull ? Math.max(held.cleanHits, totalHits) : held.cleanHits,
    parHits: held.parHits + hits.filter((hit) => hit.steps === hit.par).length,
    longestRoute: hits.reduce(
      (most, hit) => Math.max(most, hit.steps),
      held.longestRoute,
    ),
  }
}

// The tally as it stands for one run: its own figures, or nothing at all when everything
// it holds belongs to a run that is over. What a reader asks, so a run that has landed no
// hits yet cannot read the last one's.
export const tallyFor = (tally: RunTally, runSeq: number): RunTally =>
  tally.runSeq === runSeq ? tally : EMPTY_TALLY

export type RunInput = {
  inRun: boolean
  // Which run this is. A number it has not seen before is a new run, whatever `inRun`
  // says — see `AchievementPhase.runSeq`.
  runSeq: number
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
  // No run at all, and no run is ever numbered this, so the first one always reads as new.
  runSeq: -1,
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
//   - same run, started  → ignore the incoming career entirely
//   - not ready yet      → freeze nothing
//   - a run not seen yet → freeze the career now, then measure what the run has *already*
//                          done, so a late read catches up rather than missing it
export function stepAchievements(phase: AchievementPhase, input: RunInput): RunStep {
  if (!input.inRun) return { phase: IDLE, unlocked: QUIET }
  if (phase.started && phase.runSeq === input.runSeq) return evaluate(phase, input)
  if (!input.ready) return { phase, unlocked: QUIET }
  return evaluate(
    { started: true, runSeq: input.runSeq, career: input.career, fired: [] },
    input,
  )
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
