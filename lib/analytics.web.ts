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
// The nickname goes on twice, deliberately. As a person property it is the current
// answer — one value per player, overwritten when they rename themselves. As a
// registered super property it rides every event from here on, which is what makes a
// run readable on its own without joining to the person: the name the player had *at
// the time*, next to the score it produced. A rename then shows up as the boundary it
// is, rather than rewriting history back to the first run.
//
// `unregister` rather than registering null for a player who has no nickname yet: an
// absent property and a property whose value is empty are the same fact, and only one of
// them clutters every event in the project.
export const identify = (userId: string, nickname: string | null): void => {
  withClient((p) => {
    p.identify(userId, nickname === null ? undefined : { nickname })
    if (nickname === null) p.unregister('nickname')
    else p.register({ nickname })
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

// Which events open a run and which close one. A super property rides on every event
// from the moment it is registered — `$exception` included, and an unhandled exception is
// the one case with no call site of ours to pass context at. So the board a player is on
// is registered when their run starts and dropped when it ends, and a crash says where it
// happened without anything having had to catch it.
//
// Read off the events the app already sends rather than registered at each of the seven
// places a run can start: a run that begins without telling analytics is not a thing this
// app can do, so there is nothing here to forget to call.
const RUN_EDGE: Partial<Record<AnalyticsEvent, 'opens' | 'closes'>> = {
  run_started: 'opens',
  run_finished: 'closes',
  run_ended: 'closes',
  arcade_run_started: 'opens',
  arcade_run_finished: 'closes',
}

const RUN_KEYS = ['in_run', 'run_mode', 'run_difficulty'] as const

// `in_run` on its own for a mode that names no board: arcade runs on its own engine and
// carries neither a mode nor a difficulty — see analytics-events.ts — and saying so is
// more honest than inventing one. The board goes on when the event that opened the run
// has one to give.
const runContext = (properties: Record<string, unknown>): Record<string, unknown> => ({
  in_run: true,
  ...(typeof properties.mode === 'string' && { run_mode: properties.mode }),
  ...(typeof properties.difficulty === 'string' && {
    run_difficulty: properties.difficulty,
  }),
})

// `register_for_session` rather than `register`, which is the difference between a fact
// and a lie: super properties persist to localStorage, so a player who closes the tab
// mid-run would carry `in_run` into every event of their next visit. A run cannot outlive
// the session it was played in, and neither should the property that describes it.
export const track = <E extends AnalyticsEvent>(
  event: E,
  properties: AnalyticsEvents[E],
): void => {
  withClient((p) => {
    // The trail into the next exception — PostHog's own breadcrumbs, attached as
    // `$exception_steps` to whatever is captured next, ours and unhandled alike. Every
    // event the app already sends becomes a step, so a crash arrives with the screen, the
    // button and the point in the run that led to it. The buffer is PostHog's own: 32KB,
    // oldest step dropped first, emptied each time an exception carries it away.
    p.addExceptionStep(event, properties)

    const edge = RUN_EDGE[event]
    if (edge === 'opens') p.register_for_session(runContext(properties))
    if (edge === 'closes') for (const key of RUN_KEYS) p.unregister_for_session(key)

    p.capture(event, properties)
  })
}

// What PostHog can show of an error is only as good as what it is handed. An `Error` it
// parses into frames; a string, a Supabase row or anything else thrown at it arrives as a
// message with no stack at all — and a report with no stack says something broke without
// saying where. So everything is coerced to an `Error` first: one minted here points at
// the capture site rather than the throw site, which is a poorer stack than the original
// and a far better one than none.
const asError = (thrown: unknown): Error => {
  if (thrown instanceof Error) return thrown
  if (typeof thrown === 'string') return new Error(thrown)
  const message = (thrown as { message?: unknown } | null)?.message
  return new Error(typeof message === 'string' ? message : describe(thrown))
}

// A thrown value with no message of its own still has to say something: its own JSON
// beats `[object Object]`, which is a report nobody can tell apart from the next one.
// The three types `JSON.stringify` answers `undefined` for are named first — its own
// signature claims a string — and the catch is for the circular ones, which throw on the
// way to being described.
const describe = (thrown: unknown): string => {
  if (thrown === undefined) return 'undefined'
  if (typeof thrown === 'function' || typeof thrown === 'symbol') return String(thrown)
  try {
    return JSON.stringify(thrown)
  } catch {
    return 'unserialisable value'
  }
}

// The stack rides along as a property as well as inside the exception. PostHog's frames
// are what the issue is grouped by, but they are parsed — and the deployed bundle is
// minified, so when that parse comes back thin the raw text is the copy left to read.
export const captureError = (error: unknown, context?: Record<string, unknown>): void => {
  const thrown = asError(error)
  withClient((p) => {
    p.captureException(thrown, { ...context, stack: thrown.stack ?? 'none' })
  })
}
