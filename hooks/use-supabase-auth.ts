import { useEffect, useState } from 'react'

import { type Flag } from '@/constants/features'
import { knownFeatures, sameFeatures } from '@/lib/features'
import { supabase } from '@/lib/supabase'

const EMPTY_FEATURES: ReadonlySet<Flag> = new Set()

type AuthState = {
  userId: string | null
  nickname: string | null
  // What this player may be shown — the empty set for all but a handful. Resolved on
  // the server by `effective_features`, which is the only place the rules are written;
  // handed on to FlagsProvider, which is what reads it.
  //
  // Once per launch is the whole story of when a change takes effect: an admin editing
  // a stack moves everybody, and each device picks it up on its next start.
  //
  // Referentially stable while the keys do not change — see `sameFeatures`. The
  // analytics opt-out in app/(tabs)/index.tsx keys an effect on this value, and a set
  // rebuilt per render would leave that effect never settling.
  features: ReadonlySet<Flag>
  isReady: boolean
  updateNickname: (name: string) => Promise<{ error: string | null }>
}

export function useSupabaseAuth(): AuthState {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [features, setFeatures] = useState<ReadonlySet<Flag>>(EMPTY_FEATURES)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    void (async () => {
      // Reuse existing session or sign in anonymously.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      let uid = session?.user.id ?? null
      let nick: string | null = null
      let held: ReadonlySet<Flag> = EMPTY_FEATURES

      if (uid !== null) {
        // Reading the nickname doubles as checking the session is real. A stored session
        // outlives the user it names — the auth schema is wiped by every local
        // `db:reset`, and removing a row in the dashboard does the same in production —
        // and nothing in the app ever signs out, so a device left holding one is a device
        // where every write fails the `profiles` foreign key from then on. Scores,
        // achievements, feedback: all of it filed under an `auth.uid()` that is not there.
        // The profile read and the feature read are one round trip's worth of waiting
        // rather than two, and they are about different things: one asks whether this
        // session still names a real row, the other asks what that person may be shown.
        const [profile, featureRows] = await Promise.all([
          supabase.from('profiles').select('nickname').eq('id', uid).maybeSingle(),
          supabase.rpc('my_features'),
        ])
        const { data, error } = profile

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
          // A failed feature read is an ordinary player, not an error worth a screen:
          // the doors it would have opened are all unfinished work, and showing none of
          // them is the right answer to not knowing.
          held = knownFeatures(
            Array.isArray(featureRows.data) ? (featureRows.data as string[]) : [],
          )
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
        // Keep the previous set when the keys have not changed, so consumers keying an
        // effect on this value are not re-run by a new object that says the same thing.
        setFeatures((current) => (sameFeatures(current, held) ? current : held))
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

  return { userId, nickname, features, isReady, updateNickname }
}
