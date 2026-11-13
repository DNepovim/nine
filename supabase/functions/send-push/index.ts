// Drains the push outbox: claims what is owed, writes each message in its subscriber's
// language and hands it to the push service. Called once a minute by pg_cron — see
// docs/push.md for the schedule, which is a runbook step rather than a migration because
// it needs this project's URL and key.
//
// Deno, so it is outside the app's tsconfig and lint (both exclude this file); the text it
// sends is in message.ts, which is plain TypeScript and tested with the rest.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

import {
  passedMessage,
  takeoverMessage,
  type PushLocale,
  type Takeover,
} from './message.ts'

type Claimed = {
  outbox_id: number
  kind: 'takeover' | 'passed'
  // The board's mode for a takeover; the challenge's id for a passed.
  mode: string
  difficulty: string
  // Set for a takeover, null for a passed.
  period: Takeover['period'] | null
  by_nickname: string
  endpoint: string
  platform: 'web' | 'ios' | 'android'
  p256dh: string | null
  auth: string | null
  locale: PushLocale
}

const BATCH = 50

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
)

const db = createClient(supabaseUrl, serviceKey)

// The push service answers 404 or 410 for an address that is gone for good — the
// subscription was removed in the browser, or the browser itself was. Keeping the row would
// only fail again every time.
const isGone = (error: unknown): boolean => {
  const status = (error as { statusCode?: number }).statusCode
  return status === 404 || status === 410
}

async function deliver(row: Claimed): Promise<'sent' | 'gone' | 'failed' | 'skipped'> {
  // Native tokens go through Expo's push service, which is not wired in yet.
  if (row.platform !== 'web' || !row.p256dh || !row.auth) return 'skipped'
  // A takeover with no period is a row from before the column existed; the migration
  // backfilled them all to the all-time board, so this is only a type's worth of caution.
  const message =
    row.kind === 'passed'
      ? passedMessage(row.locale, { challenge: row.mode, byNickname: row.by_nickname })
      : takeoverMessage(row.locale, {
          mode: row.mode,
          difficulty: row.difficulty,
          period: row.period ?? 'ever',
          byNickname: row.by_nickname,
        })
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(message),
      // A takeover or a lost lead is stale after a day; better dropped than delivered after
      // the player has already looked.
      { TTL: 60 * 60 * 24 },
    )
    return 'sent'
  } catch (error) {
    if (isGone(error)) return 'gone'
    // Logged so a misconfigured key shows up in the function's logs rather than as silence.
    console.error('send-push: delivery failed', error)
    return 'failed'
  }
}

Deno.serve(async (request) => {
  // The key the cron job sends. `verify_jwt` already refuses a stranger; this refuses any
  // other signed-in caller, since the function writes with the service role.
  if (request.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const { data, error } = await db.rpc('drain_push_outbox', { p_limit: BATCH })
  if (error) return new Response(error.message, { status: 500 })

  const counts = { sent: 0, gone: 0, failed: 0, skipped: 0 }
  for (const row of data as Claimed[]) {
    const result = await deliver(row)
    counts[result] += 1
    if (result === 'gone') {
      const pruned = await db
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', row.endpoint)
      // A refused delete would leave the dead address to fail again every day; say so.
      if (pruned.error) console.error('send-push: prune failed', pruned.error.message)
    }
  }
  return Response.json(counts)
})
