import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

// What workbox's generated worker listens for when `skipWaiting` is false — see
// workbox-config.js. Sending it is what lets the waiting version through.
const SKIP_WAITING = { type: 'SKIP_WAITING' }

// If the new worker never takes over — it can be killed mid-swap — reload anyway. The
// worst case is booting the same version again, which is where we already were.
const SWAP_TIMEOUT_MS = 3000

// Whether a newer build of the app is sitting on the device, and the means to switch to
// it. Installed as a home-screen app, the page keeps whatever bundle it booted with, so
// a new deploy is downloaded in the background and then waits: without this it would not
// run until the player fully closed the app, which on iOS means swiping it out of the
// app switcher rather than merely leaving it.
//
// Switching ends in a reload, so the caller decides when — this hook only says when one
// is available.
export function useAppUpdate(): { ready: boolean; apply: () => void } {
  const [ready, setReady] = useState(false)
  const waitingRef = useRef<ServiceWorker | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  // The swap is one-way, and both the event and the timeout below can reach it.
  const swappingRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let cancelled = false

    const note = (worker: ServiceWorker | null) => {
      if (cancelled || worker === null) return
      waitingRef.current = worker
      setReady(true)
    }

    const onUpdateFound = () => {
      const installing = registrationRef.current?.installing
      if (installing === undefined || installing === null) return
      installing.addEventListener('statechange', () => {
        if (installing.state !== 'installed') return
        // A controller is what tells an update from the very first install. With none,
        // this worker is the app's first and there is no older version to replace.
        if (navigator.serviceWorker.controller === null) return
        note(registrationRef.current?.waiting ?? installing)
      })
    }

    // `ready` rather than getRegistration: app/+html.tsx registers on window load, which
    // may not have happened yet, and this waits for it either way.
    void navigator.serviceWorker.ready.then((registration) => {
      if (cancelled) return
      registrationRef.current = registration
      // Already waiting — the update landed in an earlier session, or before we mounted.
      note(registration.waiting)
      registration.addEventListener('updatefound', onUpdateFound)
    })

    // A launch is one update check, so an app left open for days is none at all.
    // Returning to the foreground is the cheapest honest moment to ask again.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      void registrationRef.current?.update().catch(() => {
        // Offline, most likely. The next foreground asks again.
      })
    })

    return () => {
      cancelled = true
      subscription.remove()
      registrationRef.current?.removeEventListener('updatefound', onUpdateFound)
    }
  }, [])

  const apply = useCallback(() => {
    const waiting = waitingRef.current
    if (waiting === null || swappingRef.current) return
    swappingRef.current = true

    const reload = () => {
      window.location.reload()
    }
    // Reloading before the swap would only boot the old bundle again, so this waits for
    // the new worker to take over and reloads into it.
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
    setTimeout(reload, SWAP_TIMEOUT_MS)
    waiting.postMessage(SKIP_WAITING)
  }, [])

  return { ready, apply }
}
