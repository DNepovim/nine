import { useEffect, useState } from 'react'

import { parseRole, type Role } from '@/lib/role'
import { supabase } from '@/lib/supabase'

type AuthState = {
  userId: string | null
  nickname: string | null
  // What this player may be shown — null for all but a handful. Read here rather than
  // asked for separately because the select below already runs once per launch, so a
  // role costs nothing extra; handed on to FlagsProvider, which is what reads it.
  //
  // Once per launch is also the whole story of when a role takes effect: it is set by
  // hand in SQL, and the device picks it up on its next start.
  role: Role | null
  isReady: boolean
  updateNickname: (name: string) => Promise<{ error: string | null }>
}

export function useSupabaseAuth(): AuthState {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    void (async () => {
      // Reuse existing session or sign in anonymously.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      let uid = session?.user.id ?? null
      let nick: string | null = null
      let held: Role | null = null

      if (uid !== null) {
        // Reading the nickname doubles as checking the session is real. A stored session
        // outlives the user it names — the auth schema is wiped by every local
        // `db:reset`, and removing a row in the dashboard does the same in production —
        // and nothing in the app ever signs out, so a device left holding one is a device
        // where every write fails the `profiles` foreign key from then on. Scores,
        // achievements, feedback: all of it filed under an `auth.uid()` that is not there.
        // The role rides along with the nickname rather than in a request of its own:
        // this one already has to happen, and two asks about one row are two answers
        // that can disagree about whether the row is there.
        const { data, error } = await supabase
          .from('profiles')
          .select('nickname, role')
          .eq('id', uid)
          .maybeSingle()

        // No row, from a server that answered. `maybeSingle` is what draws that line: an
        // absent profile comes back as null with no error, while a request that never
        // arrived comes back with one. The distinction is the whole point — a player who
        // is merely offline must keep their session rather than be signed out of it and
        // handed a new identity they never asked for.
        if (error === null && data === null) {
          await supabase.auth.signOut({ scope: 'local' })
          uid = null
        } else {
          nick = typeof data?.nickname === 'string' ? data.nickname : null
          // A role this build has never heard of is an ordinary player — see parseRole.
          held = parseRole(data?.role)
        }
      }

      if (uid === null) {
        const { data, error } = await supabase.auth.signInAnonymously()
        // Nothing to read back: `handle_new_user` files the profile row with the signup,
        // and a brand-new player's is empty by definition.
        if (!error && data.user) uid = data.user.id
      }

      if (uid !== null) {
        setUserId(uid)
        setNickname(nick)
        setRole(held)
      }

      setIsReady(true)
    })()
  }, [])

  const updateNickname = async (name: string): Promise<{ error: string | null }> => {
    if (!userId) return { error: 'not_authenticated' }
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: name })
      .eq('id', userId)
    if (error) {
      if (error.code === '23505') return { error: 'already_taken' }
      return { error: error.message }
    }
    setNickname(name)
    return { error: null }
  }

  return { userId, nickname, role, isReady, updateNickname }
}
