import { env } from '@/lib/env'
import type { Locale } from '@/lib/i18n/locale'
import { vapidKeyBytes } from '@/lib/push-key'
import {
  pushHelp as helpOf,
  pushReach as reachOf,
  type PushEnv,
  type PushHelp,
  type PushReach,
} from '@/lib/push-reach'
import { supabase } from '@/lib/supabase'
import type { EnableResult } from '@/types/push'

// See push.ts for the contract. This is the browser's side of it: the service worker's
// push manager makes the address, and `save_push_subscription` hands it to the server.
type StandaloneNavigator = Navigator & { standalone?: boolean }

function readEnv(): PushEnv {
  const nav: StandaloneNavigator = navigator
  return {
    // No key means nothing can be signed; `pushReach` asks before anything else.
    configured: env.EXPO_PUBLIC_VAPID_PUBLIC_KEY !== undefined,
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    hasPushApi:
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'default',
  }
}

export const pushReach = (): PushReach => reachOf(readEnv())

export const pushHelp = (): PushHelp => helpOf(readEnv())

// The player can undo a permission from outside the app, so the answer is asked again
// whenever the browser says it changed (where it can say so) and whenever the page comes back
// into view — which is where a player returns from the settings they were sent to.
export function watchPushReach(onChange: (reach: PushReach) => void): () => void {
  const check = () => {
    onChange(pushReach())
  }
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
  let status: PermissionStatus | undefined
  navigator.permissions
    .query({ name: 'notifications' })
    .then((result) => {
      status = result
      status.addEventListener('change', check)
    })
    .catch(() => {
      // Not every browser reports this one; focus and visibility still cover the return.
    })
  return () => {
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('focus', check)
    status?.removeEventListener('change', check)
  }
}

// How long to wait for a worker to be active. The production worker registers when the page
// has loaded, so a tap in the first moments can arrive before it is ready.
const WORKER_WAIT_MS = 5000

// The worker the page is already under, once it is *active* — a subscription needs one, and
// asking for permission before knowing there is one leaves a player who said yes with
// nothing subscribed. Production has workbox's, registered by the script in app/+html.tsx,
// with push-sw.js imported into it. `expo start` registers none and serves push-sw.js on its
// own, so dev falls back to registering that — and only dev: registering it in production
// could replace the offline worker with a push-only one.
async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (!existing && process.env.NODE_ENV !== 'production') {
    await navigator.serviceWorker.register('/push-sw.js')
  }
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((resolve) => {
      setTimeout(resolve, WORKER_WAIT_MS)
    }),
  ])
}

async function save(subscription: PushSubscription, locale: Locale): Promise<boolean> {
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) return false
  const res = await supabase.rpc('save_push_subscription', {
    p_platform: 'web',
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_locale: locale,
  })
  return res.error === null
}

async function subscribe(
  reg: ServiceWorkerRegistration,
): Promise<PushSubscription | undefined> {
  const key = env.EXPO_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) return undefined
  return (
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes(key),
    }))
  )
}

export async function enablePush(locale: Locale): Promise<EnableResult> {
  try {
    const reach = pushReach()
    if (reach === 'blocked') return 'blocked'
    if (reach !== 'ready') return 'failed'
    // The worker first, so the prompt is only put up for a subscription that can happen.
    const reg = await registration()
    if (!reg) return 'failed'
    const permission = await Notification.requestPermission()
    if (permission === 'denied') return 'blocked'
    if (permission !== 'granted') return 'failed'
    const subscription = await subscribe(reg)
    if (!subscription) return 'failed'
    return (await save(subscription, locale)) ? 'subscribed' : 'failed'
  } catch {
    return 'failed'
  }
}

export async function refreshPush(locale: Locale): Promise<void> {
  try {
    if (pushReach() !== 'ready' || Notification.permission !== 'granted') return
    const reg = await registration()
    const subscription = reg ? await subscribe(reg) : undefined
    if (subscription) await save(subscription, locale)
  } catch {
    // A refresh that fails is tried again next launch; nothing for the player to do.
  }
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const subscription = await reg?.pushManager.getSubscription()
    if (!subscription) return
    await supabase.rpc('drop_push_subscription', { p_endpoint: subscription.endpoint })
    await subscription.unsubscribe()
  } catch {
    // The server row is pruned the first time the push service answers 410.
  }
}
