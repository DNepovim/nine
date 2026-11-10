import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'

// The same query as the landscape guard in `global.css`, which covers the screen with ROTATE DEVICE
// on a touch device held sideways. A native build is locked to portrait and has no such screen.
const LANDSCAPE_GUARD = '(orientation: landscape) and (pointer: coarse)'

const landscapeGuard = (): MediaQueryList | null =>
  Platform.OS === 'web' && typeof window.matchMedia === 'function'
    ? window.matchMedia(LANDSCAPE_GUARD)
    : null

// Stop the run the moment the app stops being the thing on screen.
//
// Anything but `active` counts, which on iOS means the app switcher, the notification
// shade, an incoming call and the screen locking, as well as a real switch to another
// app. A timed run cannot be left running behind any of those: the clock is wall-clock,
// the player is not looking at it, and coming back to a lost life is the game taking
// something for a phone call.
//
// It is also the fix for a worse version of the same thing. JS timers are frozen while
// an app is backgrounded, so a run picked up after a minute away used to come back to
// targets that had already expired and expire them all at once. Pausing folds the active
// stretch into `elapsedMs` and the clock restarts clean on RESUME.
//
// The same goes for the phone being turned sideways on the web: the rotate-device screen covers
// the game, so the run is paused behind it rather than left to run out unseen.
//
// Web comes along for free: `react-native-web` maps `AppState` onto
// `document.visibilitychange`, so switching tabs pauses too.
export function usePauseOnBlur(playing: boolean, onPause: () => void): void {
  // Read by the listener without being one of its dependencies, so a pause handler
  // that changes identity every render cannot resubscribe mid-run.
  const pauseRef = useRef(onPause)
  useEffect(() => {
    pauseRef.current = onPause
  }, [onPause])

  useEffect(() => {
    if (!playing) return
    // A run can start playing while the app is already away — a run held for its
    // **opening** is started by the scene's own timer, which a backgrounded tab or an
    // Android app may still fire. The change that would have paused it happened before
    // this listener existed, so it is asked for here: a run that starts unwatched is
    // paused the moment it starts, and the player comes back to the pause screen.
    if (AppState.currentState !== 'active') pauseRef.current()
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') pauseRef.current()
    })
    // Held sideways already, or turned there: the rotate-device screen is up.
    const guard = landscapeGuard()
    if (guard?.matches === true) pauseRef.current()
    const turned = (event: MediaQueryListEvent) => {
      if (event.matches) pauseRef.current()
    }
    guard?.addEventListener('change', turned)
    return () => {
      subscription.remove()
      guard?.removeEventListener('change', turned)
    }
  }, [playing])
}
