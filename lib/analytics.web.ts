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
// Whether this tab is running from the home screen rather than a browser tab —
// Chromium reports it through `display-mode`, Safari through its own `navigator`
// flag with no `display-mode` support for home-screen web apps. The same check
// `useInstallPrompt` makes for the install banner, read again here rather than
// imported: that hook is React, and this runs once, before anything is mounted.
const installMode = (): 'standalone' | 'browser' => {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone ? 'standalone' : 'browser'
}

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
    // Off until the player says yes — `setReplayConsent` is the only thing that turns
    // it on, once `useReplayConsent` has an answer on file. `session_recording` is
    // still configured here rather than left to its defaults, so the moment it does
    // start it starts correctly: every input masked, the nickname prompt included,
    // which is the floor for turning this on at all. How large a share of *consenting*
    // sessions actually get recorded from there is a PostHog project setting (Settings
    // → Session replay → sampling), not a client config — it can be dialled down
    // without a redeploy, which a number baked in here could not be.
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
    },
    persistence: 'localStorage',
  })

  // `build` says which release an event came from; `install_mode` says whether the
  // session is the installed app or a browser tab — see types/install.ts. Both ride on
  // every event from here on, including the ones already queued in `waiting`.
  posthog.register({ build: BUILD_ID, install_mode: installMode() })

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

// Keeps whoever holds the `admin` role out of the data entirely, rather than filtering
// them out of it afterwards. `opt_out_capturing` is PostHog's own switch for exactly
// this — it persists in localStorage and turns every later call on this device into a
// no-op, `identify` included, so an admin playing in production never becomes a person
// in the project at all. Called ahead of `identify` at the one call site that knows the
// role, so an admin's own session never gets as far as being identified first.
//
// The reverse direction only acts when the device is actually opted out, rather than
// opting every ordinary player in on every launch: PostHog's own opt-in call captures an
// event to say so, and firing that for a player who was never opted out in the first
// place is a notification about nothing.
export const setAdminOptOut = (isAdmin: boolean): void => {
  withClient((p) => {
    if (isAdmin) p.opt_out_capturing()
    else if (p.has_opted_out_capturing()) p.opt_in_capturing()
  })
}

// Starts or stops session replay on the player's own say-so — the GDPR gate the rest of
// the config was already built to wait for. `useReplayConsent` is the only caller: it
// holds the stored answer, and this is what carries it to the SDK whenever that answer is
// 'granted' or changes.
//
// `startSessionRecording` / `stopSessionRecording` rather than toggling
// `disable_session_recording` through `set_config` directly — they are PostHog's own
// public entry points for exactly this, and `start` already leaves recording configured
// (masked inputs, EU host) and merely dormant, so there is nothing left to pass here.
export const setReplayConsent = (granted: boolean): void => {
  withClient((p) => {
    if (granted) p.startSessionRecording()
    else p.stopSessionRecording()
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
