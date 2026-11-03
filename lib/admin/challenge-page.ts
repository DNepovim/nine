import { noteRequest } from '@/lib/connectivity'
import type { SessionFigures } from '@/lib/session-order'
import { isRating, type Rating } from '@/lib/session-rating'
import { supabase } from '@/lib/supabase'
import { measureFrom, type Measure } from '@/modes'

// The two reads behind the lab's **challenge page**, beside `ratings.ts` and its per-
// challenge figures.
//
// Both swallow a failure into an empty answer with a flag, the way the lab already treats
// its sessions: the page is complete without either list, and a tester — whom
// `challenge_remarks` refuses outright — should see the page without the half they are
// not given, not an error about it.

// One **remark** on the challenge: what was said, the figure beside it if there was one,
// and which session it was about. Never who said it — see `challenge_remarks`.
export type ChallengeRemark = {
  opensAt: number
  rating: Rating | null
  remark: string
}

type RemarkRow = {
  opens_at: string
  rating: number | null
  remark: string
}

// `shown` false is a read that was refused or failed — the page hides the section rather
// than saying "No remarks yet." about remarks it could not read.
export async function listChallengeRemarks(
  modeId: string,
): Promise<{ remarks: ChallengeRemark[]; shown: boolean }> {
  const res = await supabase.rpc('challenge_remarks', { p_mode_id: modeId })
  noteRequest(res.error)
  if (res.error) return { remarks: [], shown: false }
  return {
    remarks: ((res.data as RemarkRow[] | null) ?? []).map((row) => ({
      opensAt: new Date(row.opens_at).getTime(),
      rating: row.rating !== null && isRating(row.rating) ? row.rating : null,
      remark: row.remark,
    })),
    shown: true,
  }
}

// One session of the challenge that has closed: when, how many came, and the winner's
// figures — null with nobody — for `sessionFigure` to print by the session's measure.
export type SessionLogRow = {
  id: string
  opensAt: number
  measure: Measure
  players: number
  best: SessionFigures | null
}

type LogRow = {
  id: string
  opens_at: string
  measure: string
  players: number
  best_score: number | null
  hits: number | null
  time_ms: number | null
}

export async function listSessionLog(modeId: string): Promise<SessionLogRow[]> {
  const res = await supabase.rpc('challenge_session_log', { p_mode_id: modeId })
  noteRequest(res.error)
  if (res.error) return []
  return ((res.data as LogRow[] | null) ?? []).map((row) => ({
    id: row.id,
    opensAt: new Date(row.opens_at).getTime(),
    measure: measureFrom(row.measure),
    players: row.players,
    best:
      row.best_score === null
        ? null
        : { score: row.best_score, hits: row.hits ?? 0, timeMs: row.time_ms },
  }))
}
