import type { PushReach } from '@/lib/push-reach'

// What an attempt to subscribe came to. 'blocked' is the browser saying no — to this and to
// every later ask — and 'failed' is anything that might work next time.
export type EnableResult = 'subscribed' | 'blocked' | 'failed'

// The NOTIFICATIONS row in OPTIONS. Null where there is none to show — the feature not held,
// or a device that cannot be pushed to — so the row is simply absent, not disabled.
export type PushRow = { on: boolean; reach: Exclude<PushReach, 'unsupported'> }
