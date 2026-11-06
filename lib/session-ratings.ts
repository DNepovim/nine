import { noteRequest } from '@/lib/connectivity'
import type { Rating } from '@/lib/session-rating'
import { supabase } from '@/lib/supabase'

// Writes the player's **rating** of a session. The server refuses anybody without a score
// on it — see `rate_session` — and keeps one row per player, the latest answer winning.
//
// The error is handed back rather than thrown, and the caller does nothing with it but
// close: a rating that failed to land is one opinion lost, and a dialog that stayed up
// insisting on it would be the app asking a favour twice.
export async function rateSession(
  sessionId: string,
  rating: Rating,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('rate_session', {
    p_session: sessionId,
    p_rating: rating,
  })
  noteRequest(res.error)
  return { error: res.error ? res.error.message : null }
}

// Writes the **remark** — the rating's written half — onto the same row. The same guards
// on the server, and the same bargain here: fire and forget, because the dialog closes on
// SEND whether or not it lands. Touches the words only, so a figure sent a moment
// earlier and perhaps still in flight is never overwritten — see `remark_session`.
export async function remarkSession(
  sessionId: string,
  remark: string,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('remark_session', {
    p_session: sessionId,
    p_remark: remark,
  })
  noteRequest(res.error)
  return { error: res.error ? res.error.message : null }
}

// ─── The vote ────────────────────────────────────────────────────────────────

// One of the two challenges up for **the vote**: the first two of the queue. `votes` is
// every player's, `mine` says whether the caller's own vote is on this one, and `canVote`
// whether the caller played the last challenge, which is what a vote takes.
export type VoteOption = {
  sessionId: string
  modeId: string
  votes: number
  mine: boolean
  canVote: boolean
}

type VoteOptionRow = {
  session_id: string
  mode_id: string
  votes: number
  mine: boolean
  can_vote: boolean
}

// The two options, in the order they open — an empty list when there is no choice to make,
// which is also what a failed read answers: a vote not offered is better than one offered
// and then refused.
export async function loadVoteOptions(): Promise<VoteOption[]> {
  const res = await supabase.rpc('next_vote_options')
  noteRequest(res.error)
  return ((res.data as VoteOptionRow[] | null) ?? []).map((row) => ({
    sessionId: row.session_id,
    modeId: row.mode_id,
    votes: row.votes,
    mine: row.mine,
    canVote: row.can_vote,
  }))
}

// Casts the vote, or moves it. The error is handed back for the caller to keep the dialog on
// the choice; the counts come from a fresh `loadVoteOptions` afterwards, because the server
// has the other players' votes and this side has not.
export async function voteNext(sessionId: string): Promise<{ error: string | null }> {
  const res = await supabase.rpc('vote_next', { p_session: sessionId })
  noteRequest(res.error)
  return { error: res.error ? res.error.message : null }
}
