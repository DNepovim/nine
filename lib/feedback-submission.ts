import { captureError } from '@/lib/analytics'
import { BUILD_ID } from '@/lib/analytics-events'
import { noteRequest } from '@/lib/connectivity'
import {
  feedbackOutcome,
  MAX_FEEDBACK_LENGTH,
  type FeedbackSent,
} from '@/lib/feedback-outcome'
import { supabase } from '@/lib/supabase'
import type { Difficulty, Mode } from '@/machines/game'

// One insert, awaited, so the dialog can tell the player the truth about it.
//
// The table is the only place a message goes. Nothing here reports to analytics: the
// text would then sit in two stores with different retention, and in PostHog it would
// arrive attached to a person carrying the player's nickname (`identify` in
// app/(tabs)/index.tsx). One copy, in the database we own, behind RLS.
//
// `user_id` is deliberately absent from the row: the column defaults to `auth.uid()`
// (supabase/migrations/20260819000000_feedback.sql), so the identity comes from the
// session actually making the request rather than from a prop threaded down through the
// screen. Nothing here can send it under the wrong id, and the overlay needs no
// knowledge of who the player is.
export async function submitFeedback(
  message: string,
  mode: Mode,
  difficulty: Difficulty,
  score: number,
): Promise<FeedbackSent> {
  const trimmed = message.trim().slice(0, MAX_FEEDBACK_LENGTH)

  const { error } = await supabase.from('feedback').insert({
    message: trimmed,
    mode,
    difficulty,
    score,
    build: BUILD_ID,
  })
  noteRequest(error)

  const sent = feedbackOutcome(error)

  // A refusal is the server rejecting a message a player took the trouble to write, and
  // it is invisible to us otherwise — so the failure is reported, without the text. The
  // player keeps the only copy: the dialog says it was not sent and leaves what they
  // wrote in the box to try again, which is a better home for it than our error log.
  if (sent === 'refused') {
    captureError(new Error(`feedback refused: ${error?.message ?? 'unknown'}`), {
      mode,
      difficulty,
      score,
    })
  }

  return sent
}
