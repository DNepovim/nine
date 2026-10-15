import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// The roles half. A role is a name and a stack of features, flat — nothing inherits from
// anything, so a role's stack is exactly the rows `role_feature_keys` returns.

export type AdminRole = {
  key: string
  label: string
  featureCount: number
  personCount: number
}

type RoleRow = {
  key: string
  label: string
  feature_count: number
  person_count: number
}

export async function listRoles(): Promise<{
  rows: AdminRole[]
  error: string | null
}> {
  const res = await supabase.rpc('role_stats')
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as RoleRow[] | null) ?? []).map((row) => ({
      key: row.key,
      label: row.label,
      featureCount: row.feature_count,
      personCount: row.person_count,
    })),
    error: null,
  }
}

export async function loadRoleFeatures(
  roleKey: string,
): Promise<{ keys: string[]; error: string | null }> {
  const res = await supabase.rpc('role_feature_keys', { p_role: roleKey })
  noteRequest(res.error)
  if (res.error) return { keys: [], error: res.error.message }
  return { keys: (res.data as string[] | null) ?? [], error: null }
}

// The resolved set a device would be handed if the person holding it had this role: the
// stack, minus whatever is hidden, plus whatever is public. `null` is an ordinary player
// with no role, and resolves to the public features alone.
//
// Not `loadRoleFeatures` above, which is the raw stack — the rows the ROLES screen ticks.
// This is what those rows *come to*, which is a different question and the only one a
// preview can be drawn from. Both come from SQL rather than being combined here; see
// `features_as_role`, and the note in lib/features.ts about why the resolve has one home.
export async function featuresAsRole(
  role: string | null,
): Promise<{ keys: string[]; error: string | null }> {
  const res = await supabase.rpc('features_as_role', { p_role: role })
  noteRequest(res.error)
  if (res.error) return { keys: [], error: res.error.message }
  return { keys: (res.data as string[] | null) ?? [], error: null }
}

export async function createRole(
  key: string,
  label: string,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('create_role', { p_key: key, p_label: label })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

export async function renameRole(
  key: string,
  label: string,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('rename_role', { p_key: key, p_label: label })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

export async function setRoleFeature(
  roleKey: string,
  featureKey: string,
  on: boolean,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_role_feature', {
    p_role: roleKey,
    p_key: featureKey,
    p_on: on,
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
