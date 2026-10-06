import { captureError } from '@/lib/analytics'

// What the server said when it refused — everything PostgREST puts in an error row, not
// just the sentence at the front of it.
//
// Structural rather than Supabase's own `PostgrestError`, for the same reason
// `noteRequest` in lib/connectivity.ts takes `{ message: string }`: these helpers care
// about the shape of an answer, not about which client produced it.
type ServerError = {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
}

// A refusal, reported. Every caller of this is a write the player cannot see fail — a
// score, a run, an achievement, a message they took the trouble to type — so a refusal is
// invisible unless it is logged, and useless unless it says why.
//
// `message` alone rarely does. A Postgres refusal carries the constraint or policy that
// did it in `details`, the server's own suggestion in `hint`, and the class of failure in
// `code`: 23505 is a row that already exists, 42501 is RLS turning a write away, P0001 is
// one of our own triggers raising. They go on as properties rather than into the message
// so that the issue still groups by what broke — one issue per kind of refusal, with the
// particulars on each occurrence.
export function reportRefusal(
  what: string,
  error: ServerError | null,
  context: Record<string, unknown>,
): void {
  captureError(new Error(`${what} refused: ${error?.message ?? 'unknown'}`), {
    ...context,
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  })
}
