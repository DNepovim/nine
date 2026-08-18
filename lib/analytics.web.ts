import type { PostHog } from 'posthog-js'
import posthog from 'posthog-js'

import {
  BUILD_ID,
  type AnalyticsEvent,
  type AnalyticsEvents,
} from '@/lib/analytics-events'
import { env } from '@/lib/env'
import { SHARE_URL } from '@/lib/invite-message'

// PostHog, on the web build — which is the build players actually get.
//
// Absent a key it stays off entirely rather than throwing or buffering: a fork, a CI
// job and every dev machine without the env var all run the app without sending
// anything, and none of them has to know analytics exists.
const KEY = env.EXPO_PUBLIC_POSTHOG_KEY ?? ''

// EU by default. The region is fixed when the PostHog project is created and cannot be
// moved later without a migration, so the default here is the one that keeps EU players'
// events in the EU.
const HOST = env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

// Only the production site reports. Previews land on nine--<id>.expo.app and dev on
// localhost, and every run they'd send is a test run wearing a player's clothes —
// one afternoon of poking at a preview build reads as a retention cohort. The host
// comes from SHARE_URL so a future domain move changes it in one place.
const PRODUCTION_HOST = new URL(SHARE_URL).hostname

let started = false

// The live client once `start` has run, and the calls that arrived before it did.
// Everything below queues onto `waiting` until the client exists, then replays in
// order — so an identify that beat the window's load event still lands first.
let client: PostHog | null = null
const waiting: ((p: PostHog) => void)[] = []

const withClient = (fn: (p: PostHog) => void): void => {
  if (client !== null) {
    fn(client)
    return
  }
  if (started) waiting.push(fn)
}

// The first line to touch the `posthog` binding, deliberately. posthog-js only opens
// its send gate at module evaluation: immediately if `document.readyState` is already
// 'complete', otherwise on a future DOMContentLoaded. Metro's inline requires defer
// that evaluation to the first reference — and a reference from a React effect lands
// in the gap where DOMContentLoaded has fired but the page is not yet complete, which
// leaves the gate shut and every event buffered forever, while the flags request
// (which skips the gate) goes out and makes everything look alive. Evaluating only at
// 'complete' keeps the gate open no matter which way the bundler resolves the import.
const start = (): void => {
  posthog.init(KEY, {
    api_host: HOST,
    // Off, and this is the important line in the file. Autocapture patches click and
    // input handling across the app, and the dial is the most touch-sensitive thing in
    // it — a dropped frame on a 7-second target is a worse bug than a missing funnel.
    // Everything worth knowing is sent explicitly; see analytics-events.ts.
    autocapture: false,
    // Same reason, plus this app is one route: Expo Router serves it as a single page,
    // so pageviews would report one screen forever and say nothing.
    capture_pageview: false,
    capture_pageleave: false,
    // Unhandled errors and rejections, which is the error logging half of this.
    capture_exceptions: true,
    // No session replay. It records the nickname prompt among everything else, and
    // turning it on is a consent-banner decision rather than a config one.
    disable_session_recording: true,
    persistence: 'localStorage',
  })

  posthog.register({ build: BUILD_ID })

  client = posthog
  for (const fn of waiting) fn(posthog)
  waiting.length = 0
}

export const initAnalytics = (): void => {
  if (started || KEY === '' || window.location.hostname !== PRODUCTION_HOST) return
  started = true

  if (document.readyState === 'complete') {
    start()
    return
  }
  // readyState turns 'complete' just before the window's load event fires, so by the
  // time this runs the gate check above always passes.
  window.addEventListener('load', start, { once: true })
}

// The player is already identified for the boards — the anonymous Supabase user id is
// what ranks them — so analytics reuses it rather than minting a second identity. That
// is what lets an event be read next to the score it produced.
export const identify = (userId: string, nickname: string | null): void => {
  withClient((p) => {
    p.identify(userId, nickname === null ? undefined : { nickname })
  })
}

export const track = <E extends AnalyticsEvent>(
  event: E,
  properties: AnalyticsEvents[E],
): void => {
  withClient((p) => {
    p.capture(event, properties)
  })
}

export const captureError = (error: unknown, context?: Record<string, unknown>): void => {
  withClient((p) => {
    p.captureException(error, context)
  })
}
