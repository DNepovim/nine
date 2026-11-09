import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// The two reads behind a **session**'s detail that only an admin may make, beside
// `sessions.ts`: who voted for what, and how many runs each player made. Both swallow a
// failure into `null`, the way the challenge page's reads do — the detail is complete
// without them, and a tester the server refuses should see the page without the half they
// are not given, not an error about it.

export type SessionVoter = {
  // Null for a player who never gave a nickname; the detail counts those rather than naming.
  nickname: string | null
  modeId: string
  votedAt: number
}

type VoterRow = { nickname: string | null; mode_id: string; voted_at: string }

export async function listSessionVoters(id: string): Promise<SessionVoter[] | null> {
  const res = await supabase.rpc('session_voters', { p_session: id })
  noteRequest(res.error)
  if (res.error) return null
  return ((res.data as VoterRow[] | null) ?? []).map((row) => ({
    nickname: row.nickname,
    modeId: row.mode_id,
    votedAt: new Date(row.voted_at).getTime(),
  }))
}

export type SessionRunCount = { userId: string; nickname: string | null; runs: number }

type RunCountRow = { user_id: string; nickname: string | null; runs: number }

export async function listSessionRunCounts(
  id: string,
): Promise<SessionRunCount[] | null> {
  const res = await supabase.rpc('session_run_counts', { p_session: id })
  noteRequest(res.error)
  if (res.error) return null
  return ((res.data as RunCountRow[] | null) ?? []).map((row) => ({
    userId: row.user_id,
    nickname: row.nickname,
    runs: row.runs,
  }))
}
