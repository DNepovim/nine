import { z } from 'zod'

// What survives a reply: one bit, saying an answer to this player's feedback has reached
// them at least once.
//
// Stored rather than asked, and that is the whole reason this file exists. The server
// knows about answers, but `my_feedback_replies` returns only the *unseen* ones and the
// dialog marks each one seen as it closes — so from the second launch onwards the server
// would say this player has never had an answer. The bit is written on the way past
// instead, at the one moment the app can see it happen.
//
// Shaped like `lib/how-to-play.ts`: an object with an optional boolean rather than a bare
// `true`, so a later version can put a second field beside it without the stored value
// having to change shape.
const answeredSchema = z.object({ answered: z.boolean().optional() })

function safeJson(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw)
    return value
  } catch {
    return null
  }
}

// Anything unreadable degrades to "no answer yet". That withholds an achievement the
// player had already achieved, which is the one failure here worth naming — but the
// alternative is a crash on the intro, and the next answered message hands it over
// again. Nothing else in the app hangs off this bit.
export function parseFeedbackAnswered(raw: string | null): boolean {
  if (raw === null) return false
  const parsed = answeredSchema.safeParse(safeJson(raw))
  if (!parsed.success) return false
  return parsed.data.answered === true
}

export function serializeFeedbackAnswered(answered: boolean): string {
  return JSON.stringify({ answered })
}
