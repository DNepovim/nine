import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { RUN_KEY } from '@/constants/storage'
import { positionsOf, toSavedRun, type RunSnapshot } from '@/lib/saved-run'
import type { DisplayTarget } from '@/types/game'

const write = (run: RunSnapshot, placed: readonly DisplayTarget[], now: number) => {
  const saved = toSavedRun(run, positionsOf(placed), now)
  AsyncStorage.setItem(RUN_KEY, JSON.stringify(saved)).catch(() => {})
}

const clear = () => {
  AsyncStorage.removeItem(RUN_KEY).catch(() => {})
}

// Keeps the device's copy of the run in step with the one being played, so an app that
// is closed mid-run has something to come back to. The reading half is
// hooks/use-saved-run.tsx.
//
// Not written on every press. A run is put down at three moments and no others: when it
// is paused, when a fresh one is dealt, and when the app stops being what is on screen.
// The first two are rare, and the third is the one that matters — a snapshot per dial
// press would mean a storage write several times a second through a Speed run, for a
// copy nothing would ever read.
//
// The gap that leaves is a hard kill mid-play with no warning, which comes back to the
// run as it stood at the last pause. That is a run the player recognises; nothing is one
// they do not.
export function usePersistedRun({
  inRun,
  isPaused,
  run,
  placed,
  settled,
}: {
  // Whether there is a run to keep — playing or paused. Game over is not one: a
  // finished run has nothing to come back to.
  inRun: boolean
  isPaused: boolean
  run: RunSnapshot
  // The board as the player sees it. The machine knows what is on it; only the display
  // list knows where — see hooks/use-displayed-targets.ts.
  placed: readonly DisplayTarget[]
  // Whether the launch's own saved run has been dealt with — see `SavedRunState`.
  // Nothing may be written or cleared before it has, or the restore would be racing the
  // erase of the very thing it is restoring.
  settled: boolean
}) {
  // Read by the AppState listener without being one of its dependencies: the run changes
  // on every press and the listener must not resubscribe with it.
  const runRef = useRef(run)
  runRef.current = run
  const placedRef = useRef(placed)
  placedRef.current = placed

  // Which run the device's copy is of. A RESTART from a pause deals a fresh run without
  // ever leaving `playing`, so the state name alone cannot tell that what is on disk is
  // now the previous game.
  const writtenSeq = useRef<number | null>(null)
  // Whether the key may still hold something. Starts true because the launch's own
  // answer is not this hook's to know, and the erase below has to happen once either
  // way; after that it tracks what was written, so idling on the intro does not fire a
  // removal on every re-render.
  const onDisk = useRef(true)

  useEffect(() => {
    if (!settled) return
    if (!inRun) {
      if (!onDisk.current) return
      onDisk.current = false
      writtenSeq.current = null
      clear()
      return
    }
    if (!isPaused && run.runSeq === writtenSeq.current) return
    onDisk.current = true
    writtenSeq.current = run.runSeq
    write(run, placedRef.current, Date.now())
  }, [settled, inRun, isPaused, run])

  useEffect(() => {
    if (!settled || !inRun) return
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') return
      // Read off the ref rather than waiting for the pause this same event triggers to
      // reach a render — see usePauseOnBlur. `toSavedRun` folds the clock itself, so a
      // run caught still running is written down as exactly the run a pause would have
      // produced.
      write(runRef.current, placedRef.current, Date.now())
    })
    return () => {
      subscription.remove()
    }
  }, [settled, inRun])
}
