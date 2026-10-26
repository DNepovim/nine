import { isNetworkFailure, noteRequest } from '@/lib/connectivity'
import type { LeaderboardRow } from '@/lib/leaderboard'
import type { ServerError } from '@/lib/refusal'
import { supabase } from '@/lib/supabase'
import { measureFrom, type Measure } from '@/modes'

// The player's half of a **session board**: the one card the start screen draws, one
// session's standings in full, and the write.
//
// Beside `lib/admin/sessions.ts` rather than inside it. That file is the planner's —
// everything in it is guarded by `admin` and nothing in it is reached by a player. This
// is the opposite: public reads and one write anybody signed in may make.

// A session the card could be for, with whoever is ahead on it. The shape
// `open_sessions_with_leaders` returns, which is one round trip rather than a list and
// then a leader per row.
export type OpenSession = {
  id: string
  modeId: string
  opensAt: number
  closesAt: number
  // When it was last given more time, or null. The card says so for the rest of the
  // window, which is why this rides along rather than being asked for separately.
  extendedAt: number | null
  // Null where nobody has played yet, which is every session until someone does — and
  // the second line of the card says so rather than leaving a gap.
  //
  // The two averages ride along because the card draws the name in the player's own
  // colours, like every other name the app writes on its own surface — see
  // `GradientName`. Null for a player the counters have never seen, which
  // `nameColors` reads as no saturation and draws uncoloured.
  leader: {
    nickname: string
    score: number
    // What the leader's run took, where this session is **measured** by the clock.
    // Null on a score-measured session, which has no time to show.
    timeMs: number | null
    // How many targets the leader's run took — the figure a session **measured** by
    // hits is ordered on, and carried on every session because the server always has it.
    hits: number
    avgAccuracy: number | null
    avgSpeed: number | null
  } | null
  // What this session's standings are ordered by — see `measureOf`. Stamped on the row
  // when the session was booked, so the card and the dialog read the server's answer
  // rather than resolving the challenge's rules a second time.
  measure: Measure
}

type OpenSessionRow = {
  id: string
  mode_id: string
  opens_at: string
  closes_at: string
  extended_at: string | null
  // A string on the wire: a later build's measure may arrive here — see `measureFrom`.
  measure: string
  leader_name: string | null
  leader_score: number | null
  leader_time: number | null
  // Null only from a server older than the hits measure, which read as none.
  leader_hits: number | null
  leader_acc: number | null
  leader_spd: number | null
}

const atMs = (iso: string): number => new Date(iso).getTime()

// Every session whose close is still ahead. *Which* of them the card draws — live now,
// or the next one coming — is `cardSession`'s to decide.
export async function loadOpenSessions(): Promise<{
  rows: OpenSession[]
  error: string | null
}> {
  const res = await supabase.rpc('open_sessions_with_leaders')
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as OpenSessionRow[] | null) ?? []).map((row) => ({
      id: row.id,
      modeId: row.mode_id,
      opensAt: atMs(row.opens_at),
      closesAt: atMs(row.closes_at),
      extendedAt: row.extended_at === null ? null : atMs(row.extended_at),
      measure: measureFrom(row.measure),
      leader:
        row.leader_name === null || row.leader_score === null
          ? null
          : {
              nickname: row.leader_name,
              score: row.leader_score,
              timeMs: row.leader_time,
              hits: row.leader_hits ?? 0,
              // Kept nullable rather than defaulted to zero: a nought is a real average
              // a real player can have, and `nameColors` already treats the absence as
              // no saturation. Defaulting here would have made "never counted" and
              // "counted, and bad at it" the same colour by accident.
              avgAccuracy: row.leader_acc,
              avgSpeed: row.leader_spd,
            },
    })),
    error: null,
  }
}

// One session's standings, ranked, as the server spells them.
//
// Rows rather than a `PeriodBoard`: that type lives in `hooks/use-board.ts`, and
// nothing in `lib/` imports from `hooks/` — this would be the first, and a type edge is
// still an edge. Assembling the panel's shape is the hook's job, where it already has
// the player's id to hand; see `sessionBoardOf`.
export async function loadSessionBoard(
  sessionId: string,
): Promise<{ rows: LeaderboardRow[]; error: string | null }> {
  const res = await supabase.rpc('session_board', { p_session_id: sessionId })
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return { rows: (res.data as LeaderboardRow[] | null) ?? [], error: null }
}

// Who won this challenge the last time it was aired, with the figure they won it on.
// Null on its first airing — and on a failed read, which the strip draws the same way:
// a cell with nothing honest in it is a cell left off.
export type PreviousWinner = {
  userId: string
  nickname: string
  score: number
  // Set on a race, which is won on the clock; null everywhere else.
  timeMs: number | null
  // What a session **measured** by hits was won on.
  hits: number
  avgAccuracy: number | null
  avgSpeed: number | null
}

type PreviousWinnerRow = {
  user_id: string
  nickname: string
  best_score: number
  time_ms: number | null
  hits: number | null
  avg_acc: number | null
  avg_spd: number | null
}

export async function loadPreviousWinner(
  sessionId: string,
): Promise<PreviousWinner | null> {
  const res = await supabase.rpc('previous_session_winner', { p_session_id: sessionId })
  noteRequest(res.error)
  const row = (res.data as PreviousWinnerRow[] | null)?.[0]
  if (res.error !== null || row === undefined) return null
  return {
    userId: row.user_id,
    nickname: row.nickname,
    score: row.best_score,
    timeMs: row.time_ms,
    hits: row.hits ?? 0,
    avgAccuracy: row.avg_acc,
    avgSpeed: row.avg_spd,
  }
}

// What the server said about a write. The same three answers `score-submission.ts`
// already reasons about, so a session score can ride the same queue.
export type SessionSent = 'published' | 'offline' | 'refused'

// A session score, offered to the server.
//
// The three answers are not interchangeable, and telling them apart is the whole of
// this function. **Offline** means ask again when the connection is back; the score sits
// in the queue and nothing is counted against it. **Refused** means the server said no
// for a reason that will not change — the window has shut — and asking again will be
// refused again, so it counts toward `MAX_PUBLISH_ATTEMPTS` and the entry is eventually
// retired rather than retried forever.
//
// Getting this backwards is the failure the design is most exposed to: a shut window
// reported as offline would have the queue re-offering a score to a contest that ended
// days ago, on every reconnection, for as long as the app is installed.
export async function submitSessionScore(args: {
  sessionId: string
  score: number
  hits: number
  difficulty: string
  achievedAt: string
  // What the run took, for a session measured by the clock. Undefined on every other
  // run, which the RPC defaults to null — and a null is what a score-measured row has
  // always held.
  timeMs?: number
}): Promise<{ sent: SessionSent; error: ServerError | null }> {
  const res = await supabase.rpc('submit_session_score', {
    p_session_id: args.sessionId,
    p_score: args.score,
    p_hits: args.hits,
    p_difficulty: args.difficulty,
    p_achieved_at: args.achievedAt,
    p_time_ms: args.timeMs ?? null,
  })
  noteRequest(res.error)
  if (res.error === null) return { sent: 'published', error: null }
  if (isNetworkFailure(res.error.message)) return { sent: 'offline', error: null }
  // The whole error, not its sentence: a refusal is useless unless it says why, and
  // `reportRefusal` wants the code, the details and the hint beside the message.
  return { sent: 'refused', error: res.error }
}

// Whoever took the last challenge, for the mark they wear until somebody takes the next
// one. Null when no session has ever been won, which is every day before the first one
// closes — and null on a failed read, which `mergeChampions` is told apart from an answer.
//
// Here rather than in `lib/session-summaries.ts` because this is public: it answers the
// same question for everybody, where that file answers only for its caller.
export async function loadLastSessionWinner(): Promise<{
  userId: string | null
  error: string | null
}> {
  const res = await supabase.rpc('last_session_winner')
  noteRequest(res.error)
  if (res.error) return { userId: null, error: res.error.message }
  return { userId: typeof res.data === 'string' ? res.data : null, error: null }
}
