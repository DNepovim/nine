import { useCallback, useState } from 'react'

import { type Flag } from '@/constants/features'
import { featuresAsRole } from '@/lib/admin/roles'
import { knownFeatures } from '@/lib/features'

// Borrowing a role, so an admin can see the app the way somebody holding it does.
//
// **A view, not a grant.** What this moves is the set `FlagsProvider` is fed, which is
// what decides whether a door is *drawn*. Every write is still guarded on the server by
// `has_feature(auth.uid(), …)`, which reads the caller's own row and has never heard of
// a preview — so a preview of `admin` opens no buttons that work, and the person's own
// role, overrides and analytics opt-out are untouched by it.
//
// Memory only, deliberately. A preview takes away the ADMIN link that started it — that
// is the whole point of previewing a role that does not hold it — so the badge in the
// corner is the way back out, and a reload is the way out of the way out. Persisting it
// would turn a mis-tap into a device that has to be reasoned with.

export type RolePreview = {
  // The role key being worn, or null for an ordinary player — no role at all, which is
  // all but a handful of profiles and the preview most worth having.
  role: string | null
  // What the badge prints. The label is a row in `roles` and cannot carry a message id,
  // so it is carried here from the list that was looked at rather than fetched again.
  label: string | null
  // Resolved by `features_as_role` on the server, then narrowed to what this build has
  // guards for — the same drop `knownFeatures` does to the real answer, for the same
  // reason: a key nothing here asks about opens nothing here.
  features: ReadonlySet<Flag>
}

export function useRolePreview(): {
  preview: RolePreview | null
  start: (role: string | null, label: string | null) => void
  stop: () => void
} {
  const [preview, setPreview] = useState<RolePreview | null>(null)

  // Set twice: once with nothing in it, once with the answer. The first is what takes
  // the admin screen down and puts the badge up on the tap, and an empty set is the
  // honest reading of a question the server has not answered yet — the same way
  // `FlagsProvider` answers false until auth settles. Waiting on the round trip instead
  // left the pill looking unpressed.
  const start = useCallback((role: string | null, label: string | null) => {
    setPreview({ role, label, features: new Set() })
    void (async () => {
      const res = await featuresAsRole(role)
      // Only if the preview is still the one this call was made for. Two taps in a row,
      // or a tap and an exit, and the slower answer must not land on the newer question.
      setPreview((current) =>
        current?.role === role
          ? { role, label, features: knownFeatures(res.keys) }
          : current,
      )
    })()
  }, [])

  const stop = useCallback(() => {
    setPreview(null)
  }, [])

  return { preview, start, stop }
}
