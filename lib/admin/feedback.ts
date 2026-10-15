import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// The messages half of the admin screen: what players have sent in, and which of them
// are still owed an answer.
//
// **A read and nothing else.** Answering is done by hand — the `answer-feedback` skill
// writes the row, from a machine with the production credentials, because an answer is
// written against what a build actually changed and no screen can know that. What the app
// was missing is the other half: somebody noticing a message had arrived at all, which
// until now meant going and looking in the database.

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
}

// The columns hold `timestamptz`, which arrives as an ISO string; everything above this
// line works in ms since the epoch, which is what every other clock in the app uses.
const atMs = (iso: string | null): number | null =>
  iso === null ? null : new Date(iso).getTime()

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
    })),
    error: null,
  }
}

// How many messages are still owed an answer. Its own call because its own caller is the
// **intro screen**, which puts a dot on the ADMIN link and has no business reading a
// fortnight of run figures to find out whether there is a dot.
//
// A refusal answers nought rather than propagating: the one thing this number does is
// decide whether a 7px mark is drawn, and a screen that could not reach the server has
// nothing to tell anybody about messages.
export async function countMessagesOwed(): Promise<number> {
  const res = await supabase.rpc('admin_feedback_owed')
  noteRequest(res.error)
  if (res.error) return 0
  return (res.data as number | null) ?? 0
}
