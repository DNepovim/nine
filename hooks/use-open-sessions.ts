import { useEffect, useRef, useState } from 'react'

import { loadOpenSessions, type OpenSession } from '@/lib/session-board'
import { modeById } from '@/modes'

// Every session whose close is still ahead, read once a launch and shared.
//
// Two things want this list and they are mounted nowhere near each other. The intro's
// card (`useSessionCard`, inside `menu-overlay.tsx`) draws one of them; the **summary**
// (`useSessionSummaries`, mounted beside the game screen) wants only their close times,
// so it knows when to ask whether a window it played has shut. The second is alive
// during a run, when the first has been unmounted with the intro — so there is no hook
// one can borrow from the other, and threading rows down through the screen would put a
// list on a prop that nothing between the two ends has an opinion about.
//
// A module-level store instead, which is the shape `use-announcement-request.ts` already
// uses for the same reason: two mount points with no parent in common agreeing on one
// value without a provider threaded across the app. Here it holds a *promise* rather
// than a value — the point is the single request, and a second consumer mounting while
// the first one's read is still in flight must join it rather than start another.
//
// Shared so an empty store hands back the same array every read. A fresh `[]` per
// consumer would be a new identity each time and wake every effect that depends on it.
const NOTHING: readonly OpenSession[] = []

// The launch's one read, kept so a second consumer joins it rather than repeating it.
//
// Never reset. A failed read resolves to no sessions and stays that way for the launch,
// which is exactly what the card did when it owned this read: there was no retry then
// and there is none now. The cost of being wrong is one quiet launch, and the app is
// restarted often enough that a retry loop would buy very little for the requests it
// would spend.
let pending: Promise<readonly OpenSession[]> | null = null

const openSessions = (): Promise<readonly OpenSession[]> => {
  // A session naming a challenge this build has never heard of is dropped here rather
  // than by each consumer: there is no name to print and no rules to run it under, so
  // neither the card nor a summary has anything to say about one. The same answer
  // `modeById` gives everywhere else, and a device older than the server is the ordinary
  // way it happens.
  pending ??= loadOpenSessions().then((res) =>
    res.rows.filter((row) => modeById(row.modeId) !== null),
  )
  return pending
}

// The rows, once they land. `NOTHING` until then, and `NOTHING` forever for a player the
// feature does not reach — which gates the *read* and not just what is drawn from it, the
// same rule every other launch-time read keeps.
//
// **`canSee` is given rather than asked for**, and that is not a style choice. One of the
// two callers sits *above* `FlagsProvider` — it is reached from the game screen's own body,
// and the provider is rendered in that same component's JSX — where `useFlag` can only ever
// answer false. Taking the answer as an argument is what lets each caller ask the question
// where it can actually be answered: `useSessionCard` is below the provider and passes
// `useFlag('challenges')`, and the summary's side is handed the set the provider itself is
// fed. It is the rule `app/(tabs)/index.tsx` already follows with `features.has('admin')`.
export function useOpenSessions(canSee: boolean): readonly OpenSession[] {
  const [sessions, setSessions] = useState<readonly OpenSession[]>(NOTHING)

  // A ref rather than a local `let`, which is the shape `use-board.ts` and the card both
  // use for the same job: a plain flag reads as always-false to the type checker, since
  // nothing it can see sets it between the read and the check.
  const dropped = useRef(false)

  useEffect(() => {
    if (!canSee) return
    dropped.current = false
    void openSessions().then((rows) => {
      if (dropped.current) return
      setSessions(rows)
    })
    return () => {
      dropped.current = true
    }
  }, [canSee])

  return sessions
}
