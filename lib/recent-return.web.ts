// The note the app leaves itself on the way out, so the launch that may follow knows it
// is not a cold start.
//
// A home-screen web app has no say in whether it keeps running. Switch to a mail client to
// read a verification code — which is the one thing this app ever asks a player to leave
// for — and iOS will often end the process while it is away, so coming back is a full
// boot: the logo plays, and an app the player was using thirty seconds ago appears to have
// restarted itself. Nothing can stop the eviction. What can be helped is how it reads.
//
// The window is what makes this safe to answer from, and why a timestamp is kept rather
// than a flag. A note with no clock on it would sit in storage for days and skip the
// splash on a genuinely cold start — the one launch the logo is actually for.
const KEY = 'nine.left-at.v1'

// Long enough to cover fetching a code out of another app, short enough that anything
// slower is a player who put the phone down and has come back to it fresh.
const WINDOW_MS = 90_000

// localStorage rather than the sessionStorage its neighbour `update-reload.web.ts` uses,
// and for the opposite reason: that note has to die with the window, this one has to
// survive the window being destroyed, which is the whole event it reports on.
export function noteLeaving(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Storage unavailable — Safari in private browsing throws on access rather than
    // returning null. The splash plays, which is where we were before.
  }
}

// Answered once per page load and then held, because React may call a lazy state
// initialiser twice and the clock moves between the two calls.
let answer: boolean | null = null

export function cameStraightBack(): boolean {
  if (answer !== null) return answer

  const read = (): boolean => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw === null) return false
      const left = Number(raw)
      if (!Number.isFinite(left)) return false
      // Not cleared on the way in. The app may be left and come back several times, and
      // each departure writes a fresh moment anyway; a read that cleared it would make
      // the second return of an afternoon play the logo again.
      const since = Date.now() - left
      return since >= 0 && since < WINDOW_MS
    } catch {
      return false
    }
  }

  answer = read()
  return answer
}
