import { noteRequest } from '@/lib/connectivity'
import { type Override } from '@/lib/features'
import { supabase } from '@/lib/supabase'

// The people half of the admin screen. Reads go through the `admin_people` family
// rather than a select on `profiles`, because the screen wants counts the table cannot
// give it — how many features somebody actually reaches, after their role, their
// overrides and the master switches have all been applied.

export type AdminPerson = {
  id: string
  nickname: string | null
  role: string | null
  featureCount: number
  hasOverrides: boolean
}

type PersonRow = {
  id: string
  nickname: string | null
  role: string | null
  feature_count: number
  has_overrides: boolean
}

const toPerson = (row: PersonRow): AdminPerson => ({
  id: row.id,
  nickname: row.nickname,
  role: row.role,
  featureCount: row.feature_count,
  hasOverrides: row.has_overrides,
})

// Everybody the screen has anything to say about: a role, overrides, or both. The old
// version of this asked for `role is not null`, which was the whole list until a person
// could differ from their role without holding one.
export async function listAdminPeople(): Promise<{
  rows: AdminPerson[]
  error: string | null
}> {
  const res = await supabase.rpc('admin_people')
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return { rows: ((res.data as PersonRow[] | null) ?? []).map(toPerson), error: null }
}

// Null means nobody is registered under that name, not that the request failed — the
// search box reads `error` for that. `nickname` is `citext unique`, so at most one row
// can ever answer.
export async function findPersonByNickname(nickname: string): Promise<{
  row: AdminPerson | null
  error: string | null
}> {
  const res = await supabase.rpc('admin_find_person', { p_nickname: nickname })
  noteRequest(res.error)
  if (res.error) return { row: null, error: res.error.message }
  const rows = (res.data as PersonRow[] | null) ?? []
  const first = rows[0]
  return { row: first === undefined ? null : toPerson(first), error: null }
}

// One row per feature, with everything the person screen needs to say where the answer
// came from rather than only what it is.
export type PersonFeature = {
  key: string
  override: Override
  inRoleStack: boolean
  active: boolean
}

type PersonFeatureRow = {
  key: string
  override: boolean | null
  in_role_stack: boolean
  active: boolean
}

export async function loadPersonFeatures(userId: string): Promise<{
  rows: PersonFeature[]
  error: string | null
}> {
  const res = await supabase.rpc('person_features', { p_user_id: userId })
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as PersonFeatureRow[] | null) ?? []).map((row) => ({
      key: row.key,
      override: row.override,
      inRoleStack: row.in_role_stack,
      active: row.active,
    })),
    error: null,
  }
}

// Setting a role, or taking it away with `null`. Through the RPC rather than an update —
// `profiles.role` is not in the authenticated grant at all, and the function is what
// checks the caller reaches `admin` before writing, which a client-side check never
// could. It also refuses to leave the caller, or everybody, without admin.
export async function setUserRole(
  userId: string,
  role: string | null,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// `granted` null deletes the override, which is how a feature goes back to inheriting.
export async function setUserFeature(
  userId: string,
  key: string,
  granted: Override,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_user_feature', {
    p_user_id: userId,
    p_key: key,
    p_granted: granted,
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

export async function resetUserFeatures(
  userId: string,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('reset_user_features', { p_user_id: userId })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
