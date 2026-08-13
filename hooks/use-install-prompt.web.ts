import { useCallback, useEffect, useState } from 'react'

import { isDesktopViewport } from '@/lib/desktop'
import { resolveInstallTarget } from '@/lib/install-target'
import type { InstallTarget } from '@/types/install'

// Chromium's install event. Not standardised, so lib.dom doesn't describe it.
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

// Two browser surfaces lib.dom also doesn't know about, plus the stash the
// capture script in app/+html.tsx fills before React is running. Declared as
// optional structural types rather than global augmentations: nothing here is
// asserted, so a browser missing them reads as `undefined` instead of lying.
type InstallNavigator = Navigator & {
  standalone?: boolean
  userAgentData?: { mobile: boolean }
}

type InstallWindow = Window & { __nineInstallPrompt?: BeforeInstallPromptEvent }

// Fired by the capture script once it has an event to hand over.
const INSTALLABLE_EVENT = 'nine:installable'

const readTarget = (): InstallTarget => {
  const nav: InstallNavigator = navigator
  const win: InstallWindow = window

  return resolveInstallTarget({
    // Chromium reports the installed app through display-mode; Safari has its
    // own flag and no display-mode support for home-screen web apps.
    standalone:
      win.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    hasPrompt: win.__nineInstallPrompt !== undefined,
    wideViewport: isDesktopViewport(win.innerWidth, win.innerHeight),
    uaMobile: nav.userAgentData?.mobile,
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
  })
}

export function useInstallPrompt(): {
  target: InstallTarget
  install: () => void
  dismiss: () => void
} {
  const [target, setTarget] = useState<InstallTarget>('none')
  // Session-only on purpose: closing hides the popup until the next launch, so
  // a player who keeps declining keeps being asked. No persistence key exists.
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setTarget(readTarget())

    // The install event can land before or after this effect runs; the capture
    // script stashes it either way and announces it here.
    const onInstallable = () => {
      setTarget(readTarget())
    }
    const onInstalled = () => {
      setTarget('none')
    }

    window.addEventListener(INSTALLABLE_EVENT, onInstallable)
    window.addEventListener('appinstalled', onInstalled)
    // The window's size is part of the answer now, so a window dragged across the
    // desktop threshold has to change it — otherwise the popup's idea of where it is
    // running would be whatever was true at launch.
    window.addEventListener('resize', onInstallable)
    return () => {
      window.removeEventListener(INSTALLABLE_EVENT, onInstallable)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('resize', onInstallable)
    }
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  // Hand the decision to the browser's own dialog and get out of the way. The
  // event is single-use, and coming back after someone declines the native
  // dialog in the same session would be nagging rather than helping.
  const install = useCallback(() => {
    const win: InstallWindow = window
    const event = win.__nineInstallPrompt
    win.__nineInstallPrompt = undefined
    setDismissed(true)
    void event?.prompt().catch(() => {
      // The dialog can refuse to open (already installed in another tab, or
      // fired twice). Nothing useful to say about it.
    })
  }, [])

  return { target: dismissed ? 'none' : target, install, dismiss }
}
