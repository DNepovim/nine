import { isChallengeState, type ChallengeState } from '@/lib/challenge-state'
import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// The **challenge state** half, beside sessions.ts: which challenges an admin has held
// back. The table has a row only for a challenge somebody has set, and no row is live — so
// the map this returns holds what is set and the caller reads a missing id as `live`.

type StateRow = { mode_id: string; state: string }

// A failed read answers `null`, not an empty map: an empty map reads as every challenge
// being live, which would un-hold the pending ones on screen for a network blip. The caller
// keeps what it had.
export async function listChallengeStates(): Promise<ReadonlyMap<
  string,
  ChallengeState
> | null> {
  const res = await supabase.from('challenge_states').select('mode_id, state')
  noteRequest(res.error)
  if (res.error) return null
  const rows = (res.data as StateRow[] | null) ?? []
  return new Map(
    rows.flatMap((row) =>
      isChallengeState(row.state) ? [[row.mode_id, row.state]] : [],
    ),
  )
}

// Sets a challenge live or pending. Pending takes its planned sessions out of the queue on
// the server, and `removed` says how many went — the figure the confirmation dialog named
// beforehand, handed back so a stale list shows the truth.
export async function setChallengeState(
  modeId: string,
  state: ChallengeState,
): Promise<{ removed: number; error: string | null }> {
  const res = await supabase.rpc('set_challenge_state', {
    p_mode_id: modeId,
    p_state: state,
  })
  noteRequest(res.error)
  if (res.error) return { removed: 0, error: res.error.message }
  return { removed: typeof res.data === 'number' ? res.data : 0, error: null }
}
