import { FLAGS } from '@/constants/features'
import { noteRequest } from '@/lib/connectivity'
import { parseVisibility, type Visibility } from '@/lib/features'
import { supabase } from '@/lib/supabase'

// The features half. Rows are created and removed by migration, never here — a key means
// something only because the client holds a guard for it. What this edits is the
// visibility of each one and the note beside it.

export type AdminFeature = {
  key: string
  visibility: Visibility
  note: string | null
  roleCount: number
  // After resolution: people who actually end up with it, overrides included. That is
  // the number somebody about to move the switch wants — while there is a number to
  // want. Scoped to the roled population, so it says nothing about a public feature;
  // the screen prints *everyone* for those rows rather than this.
  personCount: number
  // Whether this build has a guard for the key. False is a row the database holds and
  // the code no longer does — left behind by a migration, or a device older than the
  // server. Worth showing rather than hiding: unseen configuration is how it goes stale.
  inBuild: boolean
}

type FeatureRow = {
  key: string
  visibility: string
  note: string | null
  role_count: number
  person_count: number
}

const BUILT: ReadonlySet<string> = new Set(FLAGS)

export async function listFeatures(): Promise<{
  rows: AdminFeature[]
  error: string | null
}> {
  const res = await supabase.rpc('feature_stats')
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as FeatureRow[] | null) ?? []).map((row) => ({
      key: row.key,
      visibility: parseVisibility(row.visibility),
      note: row.note,
      roleCount: row.role_count,
      personCount: row.person_count,
      inBuild: BUILT.has(row.key),
    })),
    error: null,
  }
}

export async function setFeature(
  key: string,
  visibility: Visibility,
  note: string | null,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_feature', {
    p_key: key,
    p_visibility: visibility,
    p_note: note,
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
