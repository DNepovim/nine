import { useEffect, useRef, useState } from 'react'

import { type Flag } from '@/constants/features'
import {
  addressProblem,
  authProblem,
  codeProblem,
  normalizeEmail,
  type EmailBranch,
  type EmailProblem,
} from '@/lib/account-email'
import {
  clearProfileMoved,
  markProfileMoved,
  wasProfileMoved,
} from '@/lib/account-markers'
import { reloadApp } from '@/lib/app-reload'
import { isNetworkFailure } from '@/lib/connectivity'
import { knownFeatures, sameFeatures } from '@/lib/features'
import { resetLocalPlayer } from '@/lib/local-reset'
import { supabase } from '@/lib/supabase'

const EMPTY_FEATURES: ReadonlySet<Flag> = new Set()

// What a card gets back from any of the four calls below. Null is the only good answer;
// everything else is one of the lines `lib/account-email.ts` names.
type Answer = { error: EmailProblem | null }

const OK: Answer = { error: null }

// What asking for a code turned out to do. The branch is null whenever `error` is not —
// nothing was sent, so there is nothing for the next card to be about.
type SendResult = { error: EmailProblem | null; branch: EmailBranch | null }

// Which kind of one-time code `verifyOtp` is being handed, tried in this order.
//
// Supabase decides for itself whether an anonymous account gaining an address is a signup
// to confirm or an email change, and the two want different `type` values back. Rather
// than depend on which it picked — a thing that is theirs to change and ours to be broken
// by — the confirmation tries both. The cost is one extra request on a code that was
// going to be refused anyway; the alternative is a feature that works until it doesn't.
const ATTACH_TYPES = ['email_change', 'signup'] as const

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

  // ── The address, and the profile it brings back ──

  // The confirmed address, or null. Only a confirmed one can restore anything.
  email: string | null
  // An address that has been given and not yet confirmed. The intro's confirm line is
  // this being non-null, and nothing else.
  pendingEmail: string | null
  // This device's session was refused rather than merely unreachable, which happens for
  // exactly one reason: somebody restored this profile onto another phone.
  moved: boolean
  dismissMoved: () => void

  // One field, one call. Which of the two things it did comes back on `branch`.
  sendCode: (address: string) => Promise<SendResult>
  confirmEmail: (code: string) => Promise<Answer>
  restoreProfile: (code: string) => Promise<Answer>
}

export function useSupabaseAuth(): AuthState {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [features, setFeatures] = useState<ReadonlySet<Flag>>(EMPTY_FEATURES)
  const [isReady, setIsReady] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [moved, setMoved] = useState(false)
  // Where the last restore code was sent. Held rather than retyped: `verifyOtp` wants the
  // address beside the code, and asking the player for it twice is asking them to make
  // the same typo twice.
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)
  // Set while this hook is doing the signing out itself, so the listener below can tell
  // its own work from a session pulled out from under it. Without it, every ordinary
  // sign-out would announce that the profile had moved to another phone.
  const signingOutSelf = useRef(false)

  useEffect(() => {
    void (async () => {
      // A line left by an earlier launch, or by this one a moment from now. Read first so
      // that a player who was told their profile moved, then closed the app, is still
      // told on the launch after — closing an app is the ordinary thing to do when the
      // thing you opened it for has gone.
      setMoved(await wasProfileMoved())

      // Reuse existing session or sign in anonymously.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const session = sessionData.session

      // A session that was *refused* rather than merely unreachable. The refresh token is
      // revoked, which happens when somebody restores this profile elsewhere and that
      // device calls `signOut({ scope: 'others' })` — see `restoreProfile`.
      //
      // The distinction is the whole of this branch, and getting it wrong tells a player
      // on a train that their profile has gone. Offline, supabase-js keeps the stored
      // session and hands back a network failure; refused, it drops the session and hands
      // back the server's refusal.
      if (sessionError !== null && !isNetworkFailure(sessionError.message)) {
        await markProfileMoved()
        setMoved(true)
      }

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
        //
        // Not the same thing as the refusal above, and the difference is worth holding on
        // to: this is a session naming nobody, and nothing has been taken from anyone. It
        // leaves no note behind.
        if (error === null && data === null) {
          signingOutSelf.current = true
          await supabase.auth.signOut({ scope: 'local' })
          signingOutSelf.current = false
          uid = null
        } else {
          nick = typeof data?.nickname === 'string' ? data.nickname : null
          // A failed feature read is an ordinary player, not an error worth a screen:
          // the doors it would have opened are all unfinished work, and showing none of
          // them is the right answer to not knowing.
          held = knownFeatures(
            Array.isArray(featureRows.data) ? (featureRows.data as string[]) : [],
          )
          // Both read off the session rather than asked for: `getUser()` would be a second
          // round trip to learn what the stored user already says, and every change to it
          // passes through this hook, which updates the state as it goes.
          setEmail(session?.user.email ?? null)
          setPendingEmail(session?.user.new_email ?? null)
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

  // The other way a session ends: not at launch, but while the player is looking at the
  // app. supabase-js drops the session and announces it the moment a refresh is refused,
  // which is the same revocation the launch branch above catches a few hours earlier or
  // later depending only on when the app happened to be open.
  useEffect(() => {
    // Everything the device does about having lost its session, in one place rather than
    // inline in the listener — four closures deep is where this stops being readable.
    const adoptFreshIdentity = async (): Promise<void> => {
      await markProfileMoved()
      setMoved(true)
      setEmail(null)
      setPendingEmail(null)
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error !== null || data.user === null) return
      setUserId(data.user.id)
      setNickname(null)
      // The constant itself rather than the usual comparator: a module-level set is
      // already referentially stable, which is the only thing `sameFeatures` is for.
      setFeatures(EMPTY_FEATURES)
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' || signingOutSelf.current) return
      void adoptFreshIdentity()
    })
    return () => {
      data.subscription.unsubscribe()
    }
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

  const dismissMoved = (): void => {
    setMoved(false)
    void clearProfileMoved()
  }

  // One address, and the server decides what it meant.
  //
  // Attach is tried first, and the order is not arbitrary. `email_exists` is the one error
  // code we can be certain of; going the other way round would mean detecting *absence* of
  // an account, whose spelling has moved between Supabase versions — and reading that
  // wrong attaches an address to the wrong account. This way the uncertain case is the one
  // that never needs detecting.
  //
  // Exactly one email goes out either way: `updateUser` sends nothing when it rejects.
  //
  // The branch nobody expects is the common one. A player who already has a profile on
  // another phone taps ADD AN EMAIL and types the address they already use — and that used
  // to be a dead end telling them the address belonged to somebody else. It is theirs, and
  // this is how they get it back.
  const sendCode = async (raw: string): Promise<SendResult> => {
    const problem = addressProblem(raw)
    if (problem !== null) return { error: problem, branch: null }
    const address = normalizeEmail(raw)

    const { data, error } = await supabase.auth.updateUser({ email: address })
    if (error === null) {
      // Nothing is confirmed by this. With `enable_confirmations` on, Supabase parks the
      // address in `new_email` and sends the code; the account stays anonymous until
      // `confirmEmail` lands.
      setPendingEmail(data.user.new_email ?? address)
      return { error: null, branch: 'attach' }
    }

    const kind = authProblem(error)
    if (kind !== 'taken') return { error: kind, branch: null }

    // Somebody has this address. `shouldCreateUser: false` is belt and braces here — we
    // already know the account exists — but it is what keeps this call from ever being the
    // one that invents an account for a typo.
    setRestoreTarget(address)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false },
    })
    if (otpError !== null) return { error: authProblem(otpError), branch: null }
    return { error: null, branch: 'restore' }
  }

  const confirmEmail = async (code: string): Promise<Answer> => {
    const problem = codeProblem(code)
    if (problem !== null) return { error: problem }
    if (pendingEmail === null) return { error: 'unknown' }
    const token = code.trim()

    let last: EmailProblem = 'unknown'
    for (const type of ATTACH_TYPES) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token,
        type,
      })
      if (error === null) {
        setEmail(data.user?.email ?? pendingEmail)
        setPendingEmail(null)
        return OK
      }
      last = authProblem(error)
      // A request that never arrived says nothing about the code, so there is no point
      // asking the same question a second way.
      if (last === 'offline') return { error: last }
    }
    return { error: last }
  }

  // The six digits that move a profile onto this phone.
  //
  // The order below is the whole of it, and every step after the first is unreachable
  // until the one before it has succeeded — a refused code must leave the device exactly
  // as it was, with its own session and every key intact.
  //
  //   1. verify, which swaps the session for the restored player's
  //   2. revoke every other session, which is what makes a profile live on one phone
  //   3. clear the previous player's half of storage
  //   4. boot, because nothing in the running tree knows how to rehydrate
  //
  // Step 2 is allowed to fail quietly and is the only one that is. It is somebody else's
  // device, it will be revoked by the next successful call, and a restore that refused to
  // finish over it would strand the player holding this phone with neither profile.
  const restoreProfile = async (code: string): Promise<Answer> => {
    const problem = codeProblem(code)
    if (problem !== null) return { error: problem }
    if (restoreTarget === null) return { error: 'unknown' }

    const { data, error } = await supabase.auth.verifyOtp({
      email: restoreTarget,
      token: code.trim(),
      type: 'email',
    })
    if (error !== null) return { error: authProblem(error) }
    if (data.session === null) return { error: 'unknown' }

    // Deliberately unread. There is nothing to tell the player if this fails: the profile
    // is theirs from here, and the other phone keeps it only until any call from this one
    // revokes it.
    signingOutSelf.current = true
    await supabase.auth.signOut({ scope: 'others' })
    signingOutSelf.current = false

    await resetLocalPlayer()
    // Nothing between here and the boot. The app is signed in as the restored player with
    // the previous one's state still in memory, and every write in that window — a score
    // submission, an achievement sync, an analytics identify — would file one player's
    // history under the other's id.
    await reloadApp()
    return OK
  }

  return {
    userId,
    nickname,
    features,
    isReady,
    updateNickname,
    email,
    pendingEmail,
    moved,
    dismissMoved,
    sendCode,
    confirmEmail,
    restoreProfile,
  }
}
