import { createContext, use, useMemo, type ReactNode } from 'react'

import { type Flag } from '@/constants/features'

type FlagsState = {
  can: (flag: Flag) => boolean
}

// A default rather than a hook that throws without a provider, and for a concrete
// reason: dev/gallery.tsx renders the intro and the guide outside the app's own tree, to
// be looked at. A screen gallery must not crash on a screen it exists to show. The
// gallery hands those entries a provider of its own so nothing is hidden from it.
const FlagsContext = createContext<FlagsState>({ can: () => false })

// What the player holding the phone may be shown. Fed the set the server resolved — see
// `my_features()`, asked once per launch in hooks/use-supabase-auth.ts.
//
// `can` answers false while the set is still unknown, which it is until auth settles. A
// tester therefore watches the intro paint without their extra doors and gain them a
// moment later. That is the right way round: holding the intro on a server answer would
// cost every player a wait so that a handful avoid a flicker, and a player who reaches
// nothing — which is all but a handful — never sees anything change at all.
export function FlagsProvider({
  features,
  children,
}: {
  features: ReadonlySet<Flag>
  children: ReactNode
}) {
  const value = useMemo(() => ({ can: (flag: Flag) => features.has(flag) }), [features])
  return <FlagsContext value={value}>{children}</FlagsContext>
}

export function useFlag(flag: Flag): boolean {
  return use(FlagsContext).can(flag)
}
