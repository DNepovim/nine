import {
  crossedRecords,
  hasBoardRecord,
  type AnnouncementId,
  type RecordTargets,
} from '@/lib/announcements'
import {
  abandonedBest,
  crossedSession,
  ownRowOf,
  type SessionTargets,
} from '@/lib/session-announcements'
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
  // The run these were frozen for — see `stepRun`.
  runSeq: number
  // How far a session run has got, so a restart can say what it abandoned.
  reached: SessionFigures | null
  // What the run before this one left behind, waiting to count towards the next freeze.
  // Null except between a session restart and the freeze that follows it.
  abandoned: SessionFigures | null
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
  // Which run this is. A restart can go straight from one to the next without `inRun`
  // ever falling, so that alone can't say a new one began.
  runSeq: number
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
  runSeq: 0,
  reached: null,
  abandoned: null,
}

const QUIET = { announce: null, publish: false } as const

// What the run has crossed against whichever targets it froze. A session run with no live
// figures this render crosses nothing: its board targets are neutral, and falling back on
// them would only stay quiet for as long as they do.
function crossedOf(phase: RunPhase, input: RunInput): AnnouncementId[] {
  if (phase.session === null) return crossedRecords(input.score, phase.targets)
  if (input.session === null) return []
  return crossedSession(input.session.figures, phase.session, input.session.userId)
}

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

// The phase to go on from: this one, or on a session restart a clean one carrying what
// the abandoned run left behind.
function restartedFrom(phase: RunPhase, input: RunInput): RunPhase {
  if (phase.session === null || phase.runSeq === input.runSeq) return phase
  return {
    ...IDLE,
    abandoned: abandonedBest(phase.session.measure, phase.session.mine, phase.reached),
  }
}

const reaching = (phase: RunPhase, input: RunInput): RunPhase =>
  phase.session === null || input.session === null
    ? phase
    : { ...phase, reached: input.session.figures }

const frozenSession = (
  targets: SessionTargets | null,
  abandoned: SessionFigures | null,
): SessionTargets | null =>
  targets === null
    ? null
    : { ...targets, mine: ownRowOf(targets.measure, targets.mine, abandoned) }

// One step of a run's announcements.
//
// The rules, in order:
//   - not in a run       → back to idle, ready for the next one
//   - a session restarted→ back to idle too. Its frozen leader predates the abandoned
//                          run's post, and a `fired` carried over would keep the new run
//                          from taking the lead out loud or posting it. What the abandoned
//                          run reached counts as the player's own row: its post has not
//                          landed yet. An ordinary run restarting keeps its phase, as it
//                          always has
//   - not ready yet      → freeze nothing. Freezing nulls is what made a run begun
//                          before the boards loaded go the whole way in silence
//   - ready, not started → freeze now, then measure the score *already reached*, so a
//                          late arrival catches up instead of missing what it missed
//   - started            → ignore the incoming targets entirely. They move while the run
//                          is on, and a rival raising the bar must not quietly raise the
//                          one being chased
export function stepRun(phase: RunPhase, input: RunInput): RunStep {
  if (!input.inRun) return { phase: IDLE, ...QUIET }
  const from = restartedFrom(phase, input)
  if (from.started) return evaluate(reaching(from, input), input)
  if (!input.ready) return { phase: from, ...QUIET }
  return evaluate(
    {
      ...IDLE,
      started: true,
      targets: input.targets,
      session: frozenSession(input.session?.targets ?? null, from.abandoned),
      runSeq: input.runSeq,
      reached: input.session?.figures ?? null,
    },
    input,
  )
}
