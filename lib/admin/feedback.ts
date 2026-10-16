import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// What a message *is* — owed, answered or set aside — lives next door and pure, so the
// one rule with a decision in it can be tested. See lib/admin/message-state.ts.
export { stateOf, type MessageState } from '@/lib/admin/message-state'

// The messages half of the admin screen: what players have sent in, which of them are
// still owed an answer, and the two things that can be done about one.
//
// **It reads and now writes**, but only the quick half of writing. The `answer-feedback`
// skill still owns a considered answer: it drafts against what a session actually changed
// and sets `answer_needs_build`, so a reply saying *fixed* waits for a build that has the
// fix — a stamp read off a diff, which no phone can know. What is here is the answer that
// needs no gate, and the message that wants no answer at all.

export type AdminMessage = {
  id: string
  // Who wrote it, for the one thing the screen needs it for: a nickname goes through
  // `GradientName`, which colours it by that player's own lifetime averages and is fed by
  // id. Null is a message whose author has removed their profile — the same state as a
  // null nickname, and the reason both are nullable rather than one of them.
  authorId: string | null
  // Null is a message whose author has since removed their profile. The row outlives the
  // player deliberately — see the `on delete set null` on `feedback.user_id` — so this is
  // a real state rather than a missing join.
  nickname: string | null
  message: string
  mode: string
  difficulty: string
  score: number
  build: string
  sentAt: number
  // Null is a message still owed an answer, which is the whole of what the filter above
  // the list sorts by.
  answer: string | null
  answeredAt: number | null
  // Whether the player has collected it. The third state of a message: answered and seen
  // is finished with, answered and unseen is still in the post.
  seenAt: number | null
  // When it was set aside unanswered, or null. Admin-side and silent — the player is told
  // nothing, which is what the feedback dialog already promised them.
  dismissedAt: number | null
}

type MessageRow = {
  id: string
  user_id: string | null
  nickname: string | null
  message: string
  mode: string
  difficulty: string
  score: number
  build: string
  created_at: string
  answer: string | null
  answered_at: string | null
  answer_seen_at: string | null
  // Absent, rather than null, from a server that has not had 20261016000000 pushed to it
  // yet — see `atMs` below, which is where that is handled.
  dismissed_at: string | null | undefined
}

// The columns hold `timestamptz`, which arrives as an ISO string; everything above this
// line works in ms since the epoch, which is what every other clock in the app uses.
//
// `undefined` is a real case and not defensiveness for its own sake: the server is a
// deployment of its own, so a build can reach a player before the migration that adds a
// column does. Missing then reads as absent, which is what it is. Without it a message
// from an older `admin_feedback` would carry `new Date(undefined)` — `NaN`, which is not
// null, and every message in the list would draw as set aside.
const atMs = (iso: string | null | undefined): number | null =>
  iso === null || iso === undefined ? null : new Date(iso).getTime()

export async function listMessages(): Promise<{
  rows: AdminMessage[]
  error: string | null
}> {
  const res = await supabase.rpc('admin_feedback')
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as MessageRow[] | null) ?? []).map((row) => ({
      id: row.id,
      authorId: row.user_id,
      nickname: row.nickname,
      message: row.message,
      mode: row.mode,
      difficulty: row.difficulty,
      score: row.score,
      build: row.build,
      sentAt: new Date(row.created_at).getTime(),
      answer: row.answer,
      answeredAt: atMs(row.answered_at),
      seenAt: atMs(row.answer_seen_at),
      dismissedAt: atMs(row.dismissed_at),
    })),
    error: null,
  }
}

// The reply, written from the screen.
//
// The two stamps are the database's business — `answered_at` is set by a trigger, and so
// is clearing `answer_seen_at`, which is what makes a corrected answer arrive again
// rather than sit behind a dialog the player has already closed. The length is the
// column's own check constraint. So this hands over the words and nothing else.
export async function answerMessage(
  id: string,
  answer: string,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('admin_answer_feedback', { p_id: id, p_answer: answer })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// Set a message aside, or put it back. One call for both, because they are one decision
// made twice — and the server refuses to set aside a message that already has an answer.
export async function dismissMessage(
  id: string,
  dismissed: boolean,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('admin_dismiss_feedback', {
    p_id: id,
    p_dismissed: dismissed,
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// How many messages are still owed an answer. Its own call because its own caller is the
// **intro screen**, which puts a dot on the ADMIN link and has no business reading a
// fortnight of run figures to find out whether there is a dot.
//
// A refusal answers nought rather than propagating: the one thing this number does is
// decide whether a 7px mark is drawn, and a screen that could not reach the server has
// nothing to tell anybody about messages.
//
// It is also the **only** count of owed messages the app reads. `admin_stats` returns one
// of its own, and does not know about dismissal — see the note in lib/admin/stats.ts.
export async function countMessagesOwed(): Promise<number> {
  const res = await supabase.rpc('admin_feedback_owed')
  noteRequest(res.error)
  if (res.error) return 0
  return (res.data as number | null) ?? 0
}
