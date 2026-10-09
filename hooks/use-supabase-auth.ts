import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

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
import { sessionVerdict, type SessionVerdict } from '@/lib/session-verdict'
import { supabase } from '@/lib/supabase'

const EMPTY_FEATURES: ReadonlySet<Flag> = new Set()

// How often a device holding an address asks whether it still holds its session.
//
// Two minutes is a number picked against what goes wrong in the meantime, which is not an
// inconvenience but a wrong row: every run finished in this window is filed under a player
// who has already taken their profile to another phone. Two minutes is at most one run.
//
// It costs one request per two minutes per *addressed* player — nobody else runs this —
// and it is the only one of the three checks that catches the case that matters most,
// which is a phone left open on a table while the profile is restored somewhere else.
const SESSION_CHECK_MS = 2 * 60_000

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
  // The address beside the code, from the card that is showing it. `verifyOtp` needs both,
  // and the card is the one place that is certain to still have the address: this hook held
  // it in state until a killed process took the state with it, which on a home-screen web
  // app is the ordinary end of a trip to a mail client.
  restoreProfile: (code: string, address: string) => Promise<Answer>
}

// Everything a launch needs to know about the session it found, in one round trip.
//
// Reading the nickname doubles as checking the session is real. A stored session outlives
// the user it names — the auth schema is wiped by every local `db:reset`, and removing a
// row in the dashboard does the same in production — and nothing in the app ever signs
// out, so a device left holding one is a device where every write fails the `profiles`
// foreign key from then on. Scores, achievements, feedback: all of it filed under an
// `auth.uid()` that is not there.
//
// The three reads go together and ask different things: one whether this session still
// names a real row, one what that person may be shown, and the third whether the session
// itself is one the server still knows about.
//
// That third one is the restore, and nothing else here would catch it. `getSession` reads
// the stored session without asking anybody, and PostgREST takes an access token on its
// signature alone — measured against the local stack, a device whose session has just been
// revoked still reads its profile and runs its RPCs, and only `/auth/v1/user` answers 403.
// Which is the whole reason `getUser` is worth a request.
const inspectSession = async (
  uid: string,
): Promise<{
  verdict: SessionVerdict
  nickname: string | null
  features: ReadonlySet<Flag>
}> => {
  const [profile, featureRows, account] = await Promise.all([
    supabase.from('profiles').select('nickname').eq('id', uid).maybeSingle(),
    supabase.rpc('my_features'),
    supabase.auth.getUser(),
  ])

  return {
    verdict: sessionVerdict({
      profileError: profile.error,
      profileFound: profile.data !== null,
      accountError: account.error,
    }),
    nickname: typeof profile.data?.nickname === 'string' ? profile.data.nickname : null,
    // A failed feature read is an ordinary player, not an error worth a screen: the doors
    // it would have opened are all unfinished work, and showing none of them is the right
    // answer to not knowing.
    features: knownFeatures(
      Array.isArray(featureRows.data) ? (featureRows.data as string[]) : [],
    ),
  }
}

export function useSupabaseAuth(): AuthState {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [features, setFeatures] = useState<ReadonlySet<Flag>>(EMPTY_FEATURES)
  const [isReady, setIsReady] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [moved, setMoved] = useState(false)
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
        const found = await inspectSession(uid)

        if (found.verdict === 'live') {
          nick = found.nickname
          held = found.features
          // Read off the stored session rather than asked for: every change to either of
          // these passes through this hook, which updates the state as it goes.
          setEmail(session?.user.email ?? null)
          setPendingEmail(session?.user.new_email ?? null)
        } else {
          // The two bad verdicts share an ending — the session goes, and the launch falls
          // through to a fresh anonymous one below — and differ in the one thing that
          // matters to the player: only a profile that was taken leaves a note behind.
          if (found.verdict === 'revoked') {
            await markProfileMoved()
            setMoved(true)
          }
          signingOutSelf.current = true
          await supabase.auth.signOut({ scope: 'local' })
          signingOutSelf.current = false
          uid = null
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

  // The third way the news can arrive, and the one that decides whether a restore is a
  // move at all: this device asks, rather than waiting to be told.
  //
  // The other two are both too late on their own. The launch read only fires on a launch,
  // and a phone that is merely backgrounded never has one; the refused refresh waits on
  // the access token running down, which is an hour of this device playing — and scoring,
  // and publishing — as somebody who has already taken their profile somewhere else.
  //
  // So the question is asked on coming back to the foreground *and* on a timer while the
  // app is open. The timer is not belt and braces: a phone left open on a table never
  // backgrounds and never relaunches, and that is exactly the phone somebody walks away
  // from to restore their profile on another one.
  //
  // Only for a player holding a confirmed address. A restore is the one thing that revokes
  // a session and an address is the only thing that can ask for one, so everybody else
  // runs none of this — which is nearly everybody, nearly always.
  useEffect(() => {
    if (!isReady || email === null) return

    const check = async (): Promise<void> => {
      const { error } = await supabase.auth.getUser()
      if (error === null || isNetworkFailure(error.message)) return
      // Signed out locally rather than handled here, so that the news arriving this way
      // and the news arriving as a refused refresh end up in the same place: this fires
      // `SIGNED_OUT`, and the listener above is what a device does about losing its
      // session. `signingOutSelf` stays down on purpose — this is not our own doing.
      await supabase.auth.signOut({ scope: 'local' })
    }

    const timer = setInterval(() => void check(), SESSION_CHECK_MS)
    const subscription = AppState.addEventListener('change', (state) => {
      // Timers do not run reliably in the background on either platform, so coming back
      // is its own event rather than something the interval can be trusted to cover.
      if (state === 'active') void check()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [isReady, email])

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
        // Accepted, which is not the same as done. With `double_confirm_changes` on, a
        // change to an address that already has one needs a code from *each* of the two
        // addresses, and verifying the first is accepted with no error at all while
        // `email` stays where it was — so the only way to tell a finished change from a
        // half-finished one is to look at whether an address is still pending.
        //
        // It is read rather than assumed because the old code assumed: it set `email` to
        // `data.user.email`, which on the half-done change is still the *old* address,
        // and cleared the pending one. The player was told their address had changed, it
        // had not, and the change could no longer be finished.
        //
        // That setting is off, so this should not fire. It is here because the setting
        // lives in a dashboard this repo cannot see, and the cost of it being wrong is a
        // player who thinks a different inbox will bring their profile back.
        const stillPending = data.user?.new_email ?? null
        if (stillPending !== null && stillPending !== '') return { error: 'unknown' }

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
  const restoreProfile = async (code: string, address: string): Promise<Answer> => {
    const problem = codeProblem(code)
    if (problem !== null) return { error: problem }

    const { data, error } = await supabase.auth.verifyOtp({
      email: address,
      token: code.trim(),
      type: 'email',
    })
    if (error !== null) return { error: authProblem(error) }
    if (data.session === null) return { error: 'unknown' }

    // The move itself, and the only moment it can happen: this is the call that revokes
    // every other session on this profile, and nothing retries it later. Fail it silently
    // and the old phone keeps the profile for good — its refresh token was never revoked,
    // so it goes on refreshing forever and two devices hold one profile.
    //
    // So it is tried twice and then let go. Still nothing to tell the player either way:
    // the profile is theirs from here, and a card that said otherwise would be asking
    // them to do something about a phone they are not holding.
    signingOutSelf.current = true
    const { error: keptError } = await supabase.auth.signOut({ scope: 'others' })
    if (keptError !== null) await supabase.auth.signOut({ scope: 'others' })
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
