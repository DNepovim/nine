import { isOneOf } from 'narrowland'

import { noteRequest } from '@/lib/connectivity'
import type { SessionSummary, SummaryPlace } from '@/lib/session-summary'
import { supabase } from '@/lib/supabase'
import { measureFrom, type Difficulty } from '@/modes'

// The read behind a **summary**: every closed session this player scored on since a given
// instant, with its podium and their own figure on it.
//
// Its own file rather than another function in `lib/session-board.ts`. That one is the
// card's and the write's — what the start screen draws from, and the one thing a player
// posts. This is neither: it is read once a launch, about contests that are already over,
// and it is the only call in the app that answers for the caller alone.
//
// Eligibility is not a parameter and cannot be. The RPC finds the player through
// `auth.uid()` and returns sessions they have a `session_scores` row on, which is what
// "played it at least once" means — see the migration, which says why that is the whole
// of the access rule.

// The podium, as the RPC spells it. `rank` arrives as a JSON number rather than the
// 1 | 2 | 3 the app wants, which is what `isOneOf` below is for.
type PlaceRow = {
  rank: number
  nickname: string
  score: number
  timeMs: number | null
  // Absent from a server older than the hits measure, which read as none.
  hits?: number
  avgAcc: number | null
  avgSpd: number | null
}

type SummaryRow = {
  id: string
  mode_id: string
  closes_at: string
  // A string on the wire — see `measureFrom`.
  measure: string
  players: number
  places: readonly PlaceRow[]
  mine: {
    rank: number | null
    score: number
    timeMs: number | null
    hits?: number
    difficulty: Difficulty
    bonus: number
  }
}

const PODIUM = [1, 2, 3] as const

// The server already limits the podium to three. Narrowing it again here is not a second
// opinion about the rule — it is the only way to get from a JSON number to the union the
// page is typed on without asserting, and a row that somehow arrived outside it would be
// a place with no medal to draw.
const placeOf = (row: PlaceRow): SummaryPlace | null =>
  isOneOf(row.rank, PODIUM)
    ? {
        rank: row.rank,
        nickname: row.nickname,
        score: row.score,
        timeMs: row.timeMs,
        hits: row.hits ?? 0,
        avgAccuracy: row.avgAcc,
        avgSpeed: row.avgSpd,
      }
    : null

export async function loadSessionSummaries(
  since: number,
): Promise<{ rows: SessionSummary[]; error: string | null }> {
  const res = await supabase.rpc('my_session_summaries', {
    p_since: new Date(since).toISOString(),
  })
  noteRequest(res.error)
  // A build older than the migration lands here too: the function does not exist and
  // Postgres says so. An error rather than an empty set is the right answer — the hook
  // leaves its marker where it stands and asks again next launch, where an empty set
  // would mark a summary told that was never read.
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as SummaryRow[] | null) ?? []).map((row) => ({
      sessionId: row.id,
      modeId: row.mode_id,
      closesAt: new Date(row.closes_at).getTime(),
      measure: measureFrom(row.measure),
      places: row.places.map(placeOf).filter((place) => place !== null),
      players: row.players,
      mine: { ...row.mine, hits: row.mine.hits ?? 0 },
    })),
    error: null,
  }
}
