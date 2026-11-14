import { useEffect } from 'react'

import { useRolePreview } from '@/hooks/use-role-preview'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { identify, setAdminOptOut } from '@/lib/analytics'

// Who is playing: the account, the features it reaches or an admin is previewing, and the
// identity analytics is told.
export function usePlayerAccount() {
  const {
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
  } = useSupabaseAuth()

  // An admin borrowing a role, so they can see what a stack came to without holding it.
  // Below `useSupabaseAuth` because it stands beside its answer rather than replacing it:
  // `features` stays what this person actually reaches — the analytics opt-out just below
  // reads it, and an admin looking at the app as a player must not start being tracked —
  // and only what the tree is *drawn* from is swapped, at the provider.
  const rolePreview = useRolePreview()

  // What this player is actually shown — their own set, or the one an admin is previewing.
  //
  // Resolved **here, in the body**, and not only at the provider below. `FlagsProvider` is
  // rendered in this component's own JSX, which means it is not above this component's own
  // hooks: anything called up here that asks `useFlag` gets the default context and the
  // answer false, forever. The launch popup's pages were gated that way and two of them —
  // the **summary** and the **recap** — never appeared at all. Hooks above the provider ask
  // this set directly, the way the analytics opt-out just below already does; everything
  // rendered *inside* the provider goes on using `useFlag`.
  const shownFeatures = rolePreview.preview?.features ?? features

  // Analytics reuses the identity the boards already rank — the anonymous Supabase user
  // id — so an event can be read next to the score it produced. Re-runs when the
  // nickname lands or changes, which just refreshes the person's properties.
  //
  // The opt-out runs first: whoever reaches the `admin` feature is kept out of the data
  // entirely rather than filtered out of it afterwards, and ordering this ahead of
  // `identify` is what keeps an admin's own playing from ever becoming a person in the
  // project in the first place. The question is the feature rather than the role,
  // because a custom role granting `admin` opens the same screen.
  useEffect(() => {
    if (userId === null) return
    setAdminOptOut(features.has('admin'))
    identify(userId, nickname)
  }, [userId, nickname, features])

  return {
    confirmEmail,
    dismissMoved,
    email,
    isReady,
    moved,
    nickname,
    pendingEmail,
    restoreProfile,
    rolePreview,
    sendCode,
    shownFeatures,
    updateNickname,
    userId,
  }
}

export type ScreenAccount = ReturnType<typeof usePlayerAccount>
