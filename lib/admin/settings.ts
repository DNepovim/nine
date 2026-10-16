import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// The settings half, beside features.ts, roles.ts and sessions.ts: the general figures
// that are not about one row.
//
// There is exactly one today — how long a session's teaser runs — and the table is keyed
// by text rather than being a single row of named columns so that the second one is an
// insert rather than a migration of this module's shape. Rows are created by migration,
// the way `features` rows are; what this edits is the figure.

// The keys this build knows. A `settings` row with no key here reaches nothing — the
// same arrangement `constants/features.ts` has with the `features` table, and the same
// reason: the code holding a reader is what makes a key mean something.
export const TEASER_MINUTES = 'teaser_minutes'

type SettingRow = {
  key: string
  int_value: number
}

// Every general figure, by key.
//
// A plain select rather than an RPC: the rows are public — a lead time is configuration
// rather than a secret — and there are no counts to resolve the way `feature_stats` has.
// A `Map` rather than an object so a key the server holds and this build does not cannot
// be read by accident as `undefined`-shaped data.
export async function loadSettings(): Promise<{
  values: ReadonlyMap<string, number>
  error: string | null
}> {
  const res = await supabase.from('settings').select('key, int_value')
  noteRequest(res.error)
  if (res.error) return { values: new Map(), error: res.error.message }
  const rows = (res.data as SettingRow[] | null) ?? []
  return {
    values: new Map(rows.map((row) => [row.key, row.int_value])),
    error: null,
  }
}

// One figure, set. An RPC because the admin guard has to be the server's promise rather
// than the screen's — the same reason every other write on these screens is one.
export async function setSetting(
  key: string,
  value: number,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_setting', { p_key: key, p_int: value })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
