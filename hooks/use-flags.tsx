import { createContext, use, useMemo, type ReactNode } from 'react'

import { FLAGS, type Flag } from '@/constants/features'
import { holds, type Role } from '@/lib/role'

type FlagsState = {
  can: (flag: Flag) => boolean
}

// A default rather than a hook that throws without a provider, and for a concrete
// reason: dev/gallery.tsx renders the intro and the guide outside the app's own tree, to
// be looked at. A screen gallery must not crash on a screen it exists to show. The
// gallery hands those entries a provider of its own so nothing is hidden from it.
const FlagsContext = createContext<FlagsState>({ can: () => false })

// What the player holding the phone may be shown. Fed the role read off their profile —
// see hooks/use-supabase-auth.ts, which asks for it once per launch alongside the
// nickname.
//
// `can` answers false while the role is still unknown, which it is until auth settles.
// A tester therefore watches the intro paint without their extra tabs and gain them a
// moment later. That is the right way round: holding the intro on a server answer would
// cost every player a wait so that a handful avoid a flicker, and a player with no role
// never sees anything change at all.
export function FlagsProvider({
  role,
  children,
}: {
  role: Role | null
  children: ReactNode
}) {
  const value = useMemo(() => ({ can: (flag: Flag) => holds(role, FLAGS[flag]) }), [role])
  return <FlagsContext value={value}>{children}</FlagsContext>
}

export function useFlag(flag: Flag): boolean {
  return use(FlagsContext).can(flag)
}
