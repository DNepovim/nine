import { displayName, type AnnouncementId } from '@/lib/announcements'
import type { LeaderboardRow } from '@/lib/leaderboard'
import type { LocalScore } from '@/lib/local-scores'
import { runBeats, type SessionFigures } from '@/lib/session-order'
import type { Measure } from '@/modes'

// What the announcement bar says about the **session** being played — its own best
// passed, the lead taken, the lead taken from you — measured on the **session board** by
// the session's **measure**.
//
// A challenge keeps no board (`noBoard` in modes/challenges/define.ts), so until this a
// challenge run went the whole way in silence. Everything here asks `runBeats`, the one
// place the device writes down how a session's standings are ordered: a second copy of
// that ordering is how a run first on the standings was once told it took silver.

// The leader of a session board — row one — with who it is, so a change of hands can be
// told apart from the same player improving.
export type SessionLeader = SessionFigures & { userId: string; nickname: string | null }

// What a session run is measured against, frozen as it starts (see lib/announcement-run.ts).
export type SessionTargets = {
  measure: Measure
  // The player's own row, reconciled with what the device holds — see `ownRowOf`. Null
  // when neither has one: a first run on this session has no best to beat.
  mine: SessionFigures | null
  leader: SessionLeader | null
  // Whether the session board is *known* to hold no row at all. Distinct from a null
  // leader, which also covers a read that failed: claiming the player opened a session
  // we simply could not read would be a lie they cannot check.
  empty: boolean
}

const figuresOf = (row: LeaderboardRow): SessionFigures => ({
  score: row.best_score,
  hits: row.hits,
  timeMs: row.time_ms ?? null,
})

export const sessionLeaderOf = (
  rows: readonly LeaderboardRow[],
): SessionLeader | null => {
  const top = rows[0]
  if (top === undefined) return null
  return { ...figuresOf(top), userId: top.user_id, nickname: top.nickname }
}

// The best the device holds for one session, whatever its status — every one of them
// happened. Keyed by the session alone: reading it by mode × difficulty would pick up the
// board slot of whatever mode the challenge was built from.
export function deviceBestOf(
  store: readonly LocalScore[],
  sessionId: string,
  measure: Measure,
): SessionFigures | null {
  return store
    .filter((entry) => entry.sessionId === sessionId)
    .map((entry) => ({
      score: entry.score,
      hits: entry.hits,
      timeMs: entry.timeMs ?? null,
    }))
    .reduce<SessionFigures | null>(
      (best, run) => (best === null || runBeats(measure, run, best) ? run : best),
      null,
    )
}

// The player's own row: the better of what the session board says and what the device
// holds. The board lags every write by a round trip — the mid-run post `sessionFirst`
// makes included — so asking it alone is what would tell a second run it had beaten a
// best the first run already set. The same reconciliation `personalBar` does for a board.
export function ownRowOf(
  measure: Measure,
  boardRow: SessionFigures | null,
  device: SessionFigures | null,
): SessionFigures | null {
  if (boardRow === null) return device
  if (device === null) return boardRow
  return runBeats(measure, device, boardRow) ? device : boardRow
}

export function sessionTargetsOf({
  measure,
  rows,
  empty,
  userId,
  device,
}: {
  measure: Measure
  rows: readonly LeaderboardRow[]
  empty: boolean
  userId: string | null
  device: SessionFigures | null
}): SessionTargets {
  const mine = userId === null ? undefined : rows.find((row) => row.user_id === userId)
  return {
    measure,
    mine: ownRowOf(measure, mine === undefined ? null : figuresOf(mine), device),
    leader: sessionLeaderOf(rows),
    empty,
  }
}

// What a run needs to have for an empty session to count as opened — something of its
// own on the board, by the figure the session is ordered by.
const HAS_FIGURE = {
  score: (run) => run.score > 0,
  hits: (run) => run.hits > 0,
  // Never asked: a race announces nothing of its own, below.
  time: (run) => run.timeMs !== null,
} as const satisfies Record<Measure, (run: SessionFigures) => boolean>

// What a run being abandoned leaves as the player's own row, for the run replacing it.
//
// A restart posts the abandoned run and deals the next in the same moment, so the write
// is still on its way when the new run freezes, and neither the board nor the device has
// it yet. Asking only those two told the new run it had beaten a best the last one had
// already passed. A run that scored nothing leaves no row: counting it would make the
// first hit of the next one a best, and stop an empty session from being opened.
export function abandonedBest(
  measure: Measure,
  mine: SessionFigures | null,
  reached: SessionFigures | null,
): SessionFigures | null {
  if (reached === null || !HAS_FIGURE[measure](reached)) return mine
  return ownRowOf(measure, mine, reached)
}

// Every session line this run has crossed, biggest first.
//
// **Nothing on a race.** A run only has a time once its drill is spent, and that is the
// moment it ends — so on a time session the bar is gone before anything could be said,
// and the game-over medal already places the run by its clock. The rival's half,
// `sessionRivalChange`, still runs there.
//
// The lead is never taken from yourself: a player already first only has their own best
// to pass, and passing it is `sessionBest`.
//
// And never when your own row is already past the leader. The standings lag the device,
// and list nobody without a nickname, so a player's best can stand above a leader the
// standings still show, or on a session they still report as empty. Asking the standings
// alone told every run of such a player that it had just taken a lead their first run
// already held. Passing that row is `sessionBest`, nothing more.
export function crossedSession(
  run: SessionFigures,
  targets: SessionTargets,
  myUserId: string | null,
): AnnouncementId[] {
  const { measure, mine, leader, empty } = targets
  if (measure === 'time') return []
  const leading = leader !== null && myUserId !== null && leader.userId === myUserId
  const best = mine !== null && runBeats(measure, run, mine)
  const first =
    !leading &&
    (leader === null
      ? empty && mine === null && HAS_FIGURE[measure](run)
      : runBeats(measure, run, leader) &&
        (mine === null || !runBeats(measure, mine, leader)))
  const crossed: AnnouncementId[] = []
  if (first) crossed.push('sessionFirst')
  if (best) crossed.push('sessionBest')
  return crossed
}

// Whether a lead the session board says has gone is still the player's in fact.
//
// The board holds what was **posted**, and a run posts when it takes the lead and again
// at game over — so a leader still playing is ahead of their own row, and a rival passing
// that row has passed nothing. Told "{name} took the lead" there, the player would be
// reading a lie they can see is one. The caller keeps its baseline on the player while
// this holds, so the rival going past the run itself is still news when it happens.
export function leadKept(
  before: SessionLeader | null,
  after: SessionLeader | null,
  myUserId: string | null,
  measure: Measure,
  run: SessionFigures,
): boolean {
  if (myUserId === null || before === null || after === null) return false
  if (before.userId !== myUserId || after.userId === myUserId) return false
  return runBeats(measure, run, after)
}

// Whether another player just took the lead from this one, comparing two snapshots of
// the session board's leader — the same shape `rivalChange` gives the boards.
//
// Asked by **who** leads rather than by the figure: a leader bettering their own run is
// not a steal, and a run that took the lead from someone else was never this player's to
// lose. Only the lead changing hands *from* the player says anything; a session whose
// lead passes between two other players is noise on a busy afternoon.
export function sessionRivalChange(
  before: SessionLeader | null,
  after: SessionLeader | null,
  myUserId: string | null,
): { id: AnnouncementId; name: string } | null {
  if (myUserId === null || before === null || after === null) return null
  if (before.userId !== myUserId) return null
  if (after.userId === myUserId) return null
  return { id: 'sessionLost', name: displayName(after.nickname) }
}
