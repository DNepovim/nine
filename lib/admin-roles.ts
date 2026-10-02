import { noteRequest } from '@/lib/connectivity'
import { parseRole, type Role } from '@/lib/role'
import { supabase } from '@/lib/supabase'

// One profile as the admin screen needs it: who they are and what they hold. Nothing a
// leaderboard row already carries — no score, no averages — this is the one screen that
// is about the role rather than the game.
export type RoledProfile = {
  id: string
  nickname: string | null
  role: Role | null
}

type ProfileRow = { id: string; nickname: string | null; role: string | null }

const toRoledProfile = (row: ProfileRow): RoledProfile => ({
  id: row.id,
  nickname: row.nickname,
  role: parseRole(row.role),
})

// Every profile that currently holds a role — the admin screen's own list, so a role
// handed out is a role that can be found again without first knowing who to search for.
// A profile is public (see …_init.sql), so this is a plain select: nothing here needs the
// RPC that writing a role does.
export async function listRoledProfiles(): Promise<{
  rows: RoledProfile[]
  error: string | null
}> {
  const res = await supabase
    .from('profiles')
    .select('id, nickname, role')
    .not('role', 'is', null)
    .order('role', { ascending: false })
    .order('nickname', { ascending: true })
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as ProfileRow[] | null) ?? []).map(toRoledProfile),
    error: null,
  }
}

// A profile by its nickname, case-insensitive — `nickname` is `citext unique`, so at most
// one row can ever answer. Null means nobody is registered under that name, not that the
// request failed; `error` is what the search screen reads for that.
export async function findProfileByNickname(
  nickname: string,
): Promise<{ row: RoledProfile | null; error: string | null }> {
  const res = await supabase
    .from('profiles')
    .select('id, nickname, role')
    .eq('nickname', nickname)
    .maybeSingle()
  noteRequest(res.error)
  if (res.error) return { row: null, error: res.error.message }
  return { row: res.data === null ? null : toRoledProfile(res.data), error: null }
}

// Setting a profile's role, or taking it away with `null`. Through the `set_user_role`
// RPC rather than a direct update — `profiles.role` is not in the authenticated grant at
// all (…_profile_role.sql), and the RPC is what checks the caller actually holds `admin`
// before writing it, which a client-side role check never could.
export async function setUserRole(
  userId: string,
  role: Role | null,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
