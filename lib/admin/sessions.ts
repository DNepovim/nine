import type { SessionSpan } from '@/lib/challenge-session'
import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'
import { modeById } from '@/modes'

// The sessions half, beside features.ts and roles.ts: when a challenge is on.
//
// One read and three writes. The read is a plain select rather than a fourth RPC —
// there are no counts to resolve the way `feature_stats` has, the rows are public, and
// the start screen will want exactly this select in the phase that puts a challenge in
// front of a player. The writes are RPCs because the admin guard and the no-overlap rule
// have to be the server's promise and not the client's.

export type AdminSession = {
  id: string
  // The challenge, by registry id. A plain string rather than `ModeId`: the server has
  // never heard of a mode, so this is whatever the row says — see `inBuild`.
  modeId: string
  opensAt: number
  closesAt: number
  // Whether this build has the challenge the row names. False is a row the server holds
  // and the code does not: a session booked for a challenge that has since been taken
  // out of the catalog, or a device older than the database. The same tag and the same
  // reasoning as `AdminFeature.inBuild` — the row is drawn rather than hidden, because
  // unseen configuration is how it goes stale.
  inBuild: boolean
}

type SessionRow = {
  id: string
  mode_id: string
  opens_at: string
  closes_at: string
}

// The column holds `timestamptz`, which arrives as an ISO string; everything above this
// line works in ms since the epoch, which is what every other clock in the app uses.
const atMs = (iso: string): number => new Date(iso).getTime()

// Newest start first, which is the order the planner draws and the order a reader wants:
// what is on now and what is coming are at the top, and what already ran falls away
// below. Ordered by the server so the index does the work.
export async function listSessions(): Promise<{
  rows: AdminSession[]
  error: string | null
}> {
  const res = await supabase
    .from('challenge_sessions')
    .select('id, mode_id, opens_at, closes_at')
    .order('opens_at', { ascending: false })
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as SessionRow[] | null) ?? []).map((row) => ({
      id: row.id,
      modeId: row.mode_id,
      opensAt: atMs(row.opens_at),
      closesAt: atMs(row.closes_at),
      inBuild: modeById(row.mode_id) !== null,
    })),
    error: null,
  }
}

// `toISOString` on the way out, which is UTC — and correct, because a span is a pair of
// instants. The admin picked them on their own clock and the column stores the moment;
// the zone they were typed in is not part of what was booked.
const spanArgs = (span: SessionSpan) => ({
  p_opens_at: new Date(span.opensAt).toISOString(),
  p_closes_at: new Date(span.closesAt).toISOString(),
})

export async function planSession(
  modeId: string,
  span: SessionSpan,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('plan_challenge_session', {
    p_mode_id: modeId,
    ...spanArgs(span),
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// The challenge as well as the span. A session is one editable row rather than a booking
// that has to be torn up to be corrected — and the server re-checks the overlap against
// the mode handed in here, not the one it has stored.
export async function editSession(
  id: string,
  modeId: string,
  span: SessionSpan,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('edit_challenge_session', {
    p_id: id,
    p_mode_id: modeId,
    ...spanArgs(span),
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

export async function cancelSession(id: string): Promise<{ error: string | null }> {
  const res = await supabase.rpc('cancel_challenge_session', { p_id: id })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
