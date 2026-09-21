import { createContext, use, useMemo, type ReactNode } from 'react'

import { useInstallPrompt } from '@/hooks/use-install-prompt'
import type { InstallTarget } from '@/types/install'

type InstallState = {
  target: InstallTarget
  install: () => void
  dismiss: () => void
}

const InstallContext = createContext<InstallState>({
  target: 'none',
  install: () => {},
  dismiss: () => {},
})

// One launch, one answer. The popup is offered in two places — over the splash on a
// normal launch, and on the intro screen when there was no splash to hold — and both
// have to be the same offer: `dismiss` lasts the session, so a second copy of the hook
// would mean a popup declined over the splash coming back on the intro screen.
//
// The hook it wraps is platform-resolved: hooks/use-install-prompt.ts answers 'none' on
// native, where the app is already installed and there is nothing to ask for.
export function InstallProvider({ children }: { children: ReactNode }) {
  const { target, install, dismiss } = useInstallPrompt()
  const value = useMemo(() => ({ target, install, dismiss }), [target, install, dismiss])
  return <InstallContext value={value}>{children}</InstallContext>
}

export function useInstall(): InstallState {
  return use(InstallContext)
}
