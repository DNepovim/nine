import {
  crossedRecords,
  hasBoardRecord,
  type AnnouncementId,
  type RecordTargets,
} from '@/lib/announcements'

// What a run is measured against, and what it has already been told.
//
// This is pure on purpose. Every bug the announcement bar has had was a question of
// *when* a value was read, not of what the comparison said — targets frozen from numbers
// that had not loaded, or frozen before the previous run's score was known. Timing
// written as effects is timing nobody can test; written as a step function it is four
// rules and a table of cases.
export type RunPhase = {
  // Whether targets have been frozen for the run in progress. Until they are, the run is
  // measured against nothing and says nothing.
  started: boolean
  targets: RecordTargets
  // Everything already crossed this run, so a record announces once however many hits
  // land past it.
  fired: readonly AnnouncementId[]
}

export type RunInput = {
  inRun: boolean
  // Whether the board numbers are worth freezing yet.
  ready: boolean
  score: number
  // The live targets. Copied into the phase only at the moment of freezing; ignored
  // entirely once the run is under way.
  targets: RecordTargets
}

export type RunStep = {
  phase: RunPhase
  // The one worth putting on the bar, biggest first, or null for nothing new.
  announce: AnnouncementId | null
  // Whether this crossing should reach the board now rather than at game over.
  publish: boolean
}

const NO_TARGETS: RecordTargets = {
  record: 0,
  today: null,
  week: null,
  ever: null,
  todayEmpty: false,
  weekEmpty: false,
}

export const IDLE: RunPhase = { started: false, targets: NO_TARGETS, fired: [] }

const QUIET = { announce: null, publish: false } as const

// Measures a score against the frozen targets and folds in what it crossed.
function evaluate(phase: RunPhase, score: number): RunStep {
  const crossed = crossedRecords(score, phase.targets)
  const fresh = crossed.filter((id) => !phase.fired.includes(id))
  const next = fresh[0]
  if (next === undefined) return { phase, ...QUIET }
  // Mark every record this score cleared, not just the one being announced, so a single
  // big hit past two records celebrates once instead of twice in a row.
  const fired = [...new Set([...phase.fired, ...crossed])]
  return {
    phase: { ...phase, fired },
    announce: next,
    // A personal best is nobody else's business; only a board milestone is worth a
    // mid-run write.
    publish: hasBoardRecord(fresh),
  }
}

// One step of a run's announcements.
//
// The rules, in order:
//   - not in a run       → back to idle, ready for the next one
//   - not ready yet      → freeze nothing. Freezing nulls is what made a run begun
//                          before the boards loaded go the whole way in silence
//   - ready, not started → freeze now, then measure the score *already reached*, so a
//                          late arrival catches up instead of missing what it missed
//   - started            → ignore the incoming targets entirely. They move while the run
//                          is on, and a rival raising the bar must not quietly raise the
//                          one being chased
export function stepRun(phase: RunPhase, input: RunInput): RunStep {
  if (!input.inRun) return { phase: IDLE, ...QUIET }
  if (phase.started) return evaluate(phase, input.score)
  if (!input.ready) return { phase, ...QUIET }
  return evaluate({ started: true, targets: input.targets, fired: [] }, input.score)
}
