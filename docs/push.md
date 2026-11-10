# Push

Notifications while the app is closed. Web only so far; the table already carries a
`platform` column for native. One trigger: a board you held was taken. Behind the `push`
feature, hidden until it is made public from the admin screen.

## How it fits together

```
board_reigns insert ──trigger──▶ push_outbox ──every minute──▶ send-push ──▶ push service ──▶ device
                                  (one row per player,           (claims a batch,       (Apple / Google /
                                   board and Prague day)          writes the text)       Mozilla)
```

- `push_subscriptions` — one row per device, saved by the app through `save_push_subscription`.
- `push_outbox` — pushes owed. The unique `(user, board, day)` is the throttle.
- `supabase/functions/send-push` — drains the outbox. Text in `message.ts`, en and cs.
- `public/push-sw.js` — the browser's `push` and `notificationclick` handlers, pulled into the
  generated service worker by `importScripts` in `workbox-config.js`.
- The consent is the second step after session recording (`usePushConsent`), and a row in OPTIONS.

## Going live — the production steps

None of these is run by the build. Each is a production write.

1. **VAPID keys**, once: `pnpm dlx web-push generate-vapid-keys`. Keep the private half out of git.
2. **Function secrets**:
   `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:you@…`
   (`SUPABASE_URL` and the service key are provided by the platform.)
3. **The public key in the web build**: set `EXPO_PUBLIC_VAPID_PUBLIC_KEY` wherever
   `EXPO_PUBLIC_SUPABASE_*` is set (EAS and the GitHub secrets). Without it push reads as
   unsupported and nothing shows.
4. **Schema first** — migrations are not applied by CI: `pnpm db:push`, then check the
   migration list for `push_subscriptions` and `push_feature`.
5. **Deploy the function**: `supabase functions deploy send-push`.
6. **Schedule it.** Needs `pg_cron` and `pg_net` enabled, and the service key kept in the vault:

   ```sql
   select vault.create_secret('<service role key>', 'service_role_key');
   select cron.schedule('send-push', '* * * * *', $$
     select net.http_post(
       url     := 'https://<project-ref>.supabase.co/functions/v1/send-push',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                       where name = 'service_role_key'))
     )
   $$);
   ```

7. **Make it public** from the admin screen's features tab when ready. Existing players meet the
   card on their next startup; new ones meet it after the recording card.

## Trying it locally

- The API is on `127.0.0.1:54399` here (`nine-kong-proxy`), not 54321.
- `supabase functions serve send-push --env-file <file with the three VAPID_ vars>`, then
  `POST` it with `Authorization: Bearer <local service role key>`. Without the key it answers 401.
- Delivery to a real push service needs a browser: serve the web build over HTTPS (or
  localhost), enable the card, then take the board from a second profile.
- iOS only grants push to the app added to the Home Screen, and only from a tap.

## Not done yet

Native iOS/Android (`expo-notifications`, Expo's push service — `send-push` skips non-web
rows), challenge session boards as a trigger, and any second kind of push.
