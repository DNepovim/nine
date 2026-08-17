import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { AppState } from 'react-native'

import { boardOf, type BoardRef } from '@/lib/board-events'
import { supabase } from '@/lib/supabase'

// One live connection to the boards, for the whole app and every screen on it.
//
// Everything that shows a score is a standing on some board — the leaderboards, the
// strip above the dial, the medal line on the intro — and all of it should move the
// moment the boards do. So there is one subscription, covering every board rather than
// the one being played, and it is never torn down: a channel that came and went with
// the active mode × difficulty meant every switch cost a reconnection, and it left the
// medal line, which spans all six boards, watching only one of them.
//
// Listeners are told *which* board moved so each can decide whether it cares. Null means
// we cannot say — a reconnection, or a row we could not attribute — and the honest
// reading of that is that anything may have changed.
export type BoardListener = (moved: BoardRef | null) => void

const listeners = new Set<BoardListener>()

// Opened on the first subscription and kept for the life of the JS context. Ref-counting
// it down to zero would tear the channel out and rebuild it on every remount, since a
// React cleanup runs before the effect replacing it.
let started = false
// A first SUBSCRIBED is the connection opening, and the callers have just fetched. Every
// later one is a reconnection, and the gap it closes could hide anything.
let everSubscribed = false

const announce = (moved: BoardRef | null): void => {
  for (const listener of listeners) listener(moved)
}

function start(): void {
  started = true
  supabase
    .channel(`boards:${Math.random().toString(36).slice(2)}`)
    // No filter: every board is watched, and attribution is done from the row itself.
    // `postgres_changes` takes a single filter expression anyway, which was never enough
    // to name a board — see boardOf. Both tables need REPLICA IDENTITY FULL, set in
    // migration 20260723000000_enable_realtime.sql, or DELETE would carry no row.
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'scores' },
      (payload) => {
        announce(boardOf(payload))
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_scores' },
      (payload) => {
        announce(boardOf(payload))
      },
    )
    .subscribe((status) => {
      if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) return
      if (everSubscribed) announce(null)
      everSubscribed = true
    })

  // A phone that spent the last hour asleep has missed every event in it, and Realtime
  // gives no backlog. Coming back to the foreground is the only notice we get.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') announce(null)
  })
}

export function subscribeBoards(listener: BoardListener): () => void {
  listeners.add(listener)
  if (!started) start()
  return () => {
    listeners.delete(listener)
  }
}
