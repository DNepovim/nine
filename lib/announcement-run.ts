import {
  crossedRecords,
  hasBoardRecord,
  type AnnouncementId,
  type RecordTargets,
} from '@/lib/announcements'
import { crossedSession, type SessionTargets } from '@/lib/session-announcements'
import type { SessionFigures } from '@/lib/session-order'

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
  // A **session** run's targets, frozen the same moment and by the same rules, or null
  // for an ordinary run. When set, the board targets above are not asked at all: a
  // challenge keeps no board, and the empty leaderboard its mode id reads would
  // otherwise have every challenge run told it had opened today's.
  session: SessionTargets | null
  // Everything already crossed this run, so a record announces once however many hits
  // land past it.
  fired: readonly AnnouncementId[]
}

// What a session run is measured by, live: the targets to freeze, and the run's own
// figures to measure against them — a session may be ordered by hits or the clock, so a
// score alone cannot say.
export type SessionRun = {
  targets: SessionTargets
  figures: SessionFigures
  userId: string | null
}

export type RunInput = {
  inRun: boolean
  // Whether the board numbers are worth freezing yet.
  ready: boolean
  score: number
  // The live targets. Copied into the phase only at the moment of freezing; ignored
  // entirely once the run is under way.
  targets: RecordTargets
  // Set on a session run, and only then. Its `targets` are copied in at the same moment
  // as the board's and ignored afterwards in the same way.
  session: SessionRun | null
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

export const IDLE: RunPhase = {
  started: false,
  targets: NO_TARGETS,
  session: null,
  fired: [],
}

const QUIET = { announce: null, publish: false } as const

// What the run has crossed against whichever targets it froze.
const crossedOf = (phase: RunPhase, input: RunInput): AnnouncementId[] =>
  phase.session === null || input.session === null
    ? crossedRecords(input.score, phase.targets)
    : crossedSession(input.session.figures, phase.session, input.session.userId)

// Measures a run against the frozen targets and folds in what it crossed.
function evaluate(phase: RunPhase, input: RunInput): RunStep {
  const crossed = crossedOf(phase, input)
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
    // mid-run write — and on a session, taking the lead, which is the write that wakes
    // the bar of whoever just lost it.
    publish: hasBoardRecord(fresh) || fresh.includes('sessionFirst'),
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
  if (phase.started) return evaluate(phase, input)
  if (!input.ready) return { phase, ...QUIET }
  return evaluate(
    {
      started: true,
      targets: input.targets,
      session: input.session?.targets ?? null,
      fired: [],
    },
    input,
  )
}
