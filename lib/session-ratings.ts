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
