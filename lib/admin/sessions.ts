import type { SessionSpan } from '@/lib/challenge-session'
import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'
import { measureOf, modeById } from '@/modes'

// The sessions half, beside features.ts and roles.ts: when a challenge is on.
//
// One read and five writes. The read is a plain select rather than a sixth RPC —
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
  // When it was last given more time, or null.
  extendedAt: number | null
  // How many players have scored on it. The form locks on **this**, not on whether the
  // session is live, because that is what the server locks on — a board is a contest
  // people have run in, and a live session nobody has touched is still just a booking.
  // See the edit guard in 20261016020000_session_controls.sql.
  played: number
}

type SessionRow = {
  id: string
  mode_id: string
  opens_at: string
  closes_at: string
  extended_at: string | null
  // PostgREST's embedded aggregate: one row holding the count of the related rows. Asked
  // for here rather than through a fifth RPC, which is what the read already avoids.
  session_scores: { count: number }[]
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
    .select('id, mode_id, opens_at, closes_at, extended_at, session_scores(count)')
    .order('opens_at', { ascending: false })
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as SessionRow[] | null) ?? []).map((row) => ({
      id: row.id,
      modeId: row.mode_id,
      opensAt: atMs(row.opens_at),
      closesAt: atMs(row.closes_at),
      extendedAt: row.extended_at === null ? null : atMs(row.extended_at),
      played: row.session_scores[0]?.count ?? 0,
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

// What a session is **measured** by, taken from the challenge rather than asked for.
//
// A measure is a fact about the challenge — a race is a race whenever it is aired — so
// the planner has nothing to decide and no field for it. Resolved here, in the one place
// a booking is written, rather than on the form: a second caller that forgot would book
// a race measured by its score, and nothing would look wrong until the standings came
// out in the wrong order.
const measureArg = (modeId: string) => ({ p_measure: measureOf(modeId) })

export async function planSession(
  modeId: string,
  span: SessionSpan,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('plan_challenge_session', {
    p_mode_id: modeId,
    ...spanArgs(span),
    ...measureArg(modeId),
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
    // Re-pointing a booking at another challenge re-measures it. Only reachable while
    // nobody has scored — the server refuses a challenge change after that — so a
    // session's measure cannot move once it means something.
    ...measureArg(modeId),
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// Deletes the booking, and the server refuses it for a live session or one anybody has
// scored on — see the guard in 20261016020000_session_controls.sql. The screen hides the
// button in those cases; this is the promise underneath it.
export async function cancelSession(id: string): Promise<{ error: string | null }> {
  const res = await supabase.rpc('cancel_challenge_session', { p_id: id })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// Shuts a live window now, keeping its board. Not a cancel, and the two are one keystroke
// apart on the same screen: cancelling deletes a booking nobody has played, and this
// settles the standings of one that is running.
export async function closeSessionEarly(id: string): Promise<{ error: string | null }> {
  const res = await supabase.rpc('close_challenge_session_early', { p_id: id })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// Moves a live window's end forward, and marks it as given more time. Minutes, because
// the dialog asks for hours and minutes and one figure is what the server wants — the
// screen does that sum, not this.
export async function extendSession(
  id: string,
  minutes: number,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('extend_challenge_session', {
    p_id: id,
    p_minutes: minutes,
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
