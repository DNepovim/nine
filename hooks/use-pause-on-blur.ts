import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

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
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') pauseRef.current()
    })
    return () => {
      subscription.remove()
    }
  }, [playing])
}
