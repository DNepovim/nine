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

// Refused while anybody holds it. The error says how many, because a constraint name is
// not something to show to somebody holding a phone.
export async function deleteRole(key: string): Promise<{ error: string | null }> {
  const res = await supabase.rpc('delete_role', { p_key: key })
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
