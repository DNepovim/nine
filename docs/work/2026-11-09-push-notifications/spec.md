# Push notifications

Slug: push-notifications
Stage: shipped
Next: /deploy — after the production steps in docs/push.md (db:push, VAPID secrets, deploy send-push, cron), then a human pass on a Chrome with notifications allowed
Track: full
Branch: feat/push-notifications
Started: 2026-11-09

## Problem

A player who holds a board has no way to learn it was taken from them until they next
open the app — the takeover is the single most retention-worthy event in the game, and
it lands while nobody is looking.

## Appetite

**A week.** New table, the first edge function in the repo, a service worker, a consent
step, new domain words. Decided inline: it names new things and touches the schema.
If it overruns, the native adapter and the challenge boards stay out — never the consent.

## Shape

1. Cold start, new player: after the replay consent card is answered, a **second step**
   asks about push. Same card family, same "unknown / granted / denied" rule.
2. Cold start, existing player, once the `push` feature goes public: the same step
   appears alone, as a dialog. One rule covers both — _feature visible and the answer is
   still `unknown`_ — so there is no "older than the feature" check to write.
3. Granting on web: the page registers `sw.js`, subscribes to the push manager with the
   VAPID key, and stores the subscription against the profile. iOS needs the PWA on the
   Home Screen and a tap; off it, the step says so instead of failing.
4. Options gets a row to turn it on or off, beside the replay row; off deletes the
   subscription server-side.
5. A player takes an all-time board (a **takeover**, `board_reigns` closing a reign):
   the displaced holder gets one push — "{nickname} took your record on {board}".
   Tapping opens the app on the intro.

Areas:

- **Consent / launch:** `use-replay-consent` generalised or a sibling hook, the consent
  overlay gaining a second step, a new storage key.
- **Options:** one toggle row in `advanced-options-overlay.tsx`.
- **Client:** `lib/push.ts` + `lib/push.web.ts` (native file stubbed), `public/push-sw.js` pulled into the existing Workbox worker (see Contract — there is no hand-written `sw.js`).
- **Feature:** one key `push` in `constants/features.ts` + the feature rows migration.
- **Schema:** `push_subscriptions` (profile, platform, token/endpoint+keys, locale), RLS
  own-rows, an RPC to save and one to drop; a trigger/hook where a reign closes.
- **Server:** `supabase/functions/send-push` (does not exist yet — the first function).
- **Copy:** every string through `pnpm i18n:extract`, Czech included; the push text itself
  is built server-side, so its Czech lives next to the function, not in the catalog.
- **Not a mode's business** — takeovers are board facts, no rule or capability on `RunRules`.

Domain: players read **record**, code says **takeover** (`Takeover`, `board_reigns`) — the
notification speaks of a record and the code never does. New words to settle in `spec`:
the subscription, and the consent's two steps.

## In

- Feature key `push`, hidden until made public.
- Web push end to end, behind the two-step consent and the options toggle.
- One trigger: your all-time board was taken.
- Subscription cleanup on toggle-off, on dead endpoints, and in `local-reset`.

## Out

- Native iOS/Android adapter (`expo-notifications`). The table has a `platform` column so
  it slots in later; no native code now.
- Challenge **session boards** as a trigger. "Any challenge" is the MVP wish, but session
  standings churn every run; it needs its own throttle and is the first follow-up.
- Weekly/daily boards, winnings, session-opening reminders, any second trigger.
- A notification-preferences screen finer than on/off.
- Local scheduled reminders.

## Rabbit holes

- **No edge functions exist.** The first deploy needs VAPID keys as secrets and a
  production write — the user's, per CLAUDE.md and the advisor's "always" list.
  Way round: build and test locally with `supabase functions serve`, hand over the deploy
  command. If this will not go local, the appetite does not hold.
- **Migrations are not applied by CI** — the schema and trigger must be pushed before the
  build that calls them ships.
- **Service worker.** `dist/sw.js` is _generated_ by `workbox generateSW` in `build:web`, so
  push handlers cannot be written into it — they ride in via `importScripts`. Verify the
  built file carries the import before anything is built on it.
- **iOS web push** works only from an installed PWA after a tap. Way round: detect and
  show an "add to Home Screen" line; never request permission off-gesture.
- **Takeover spam.** A board changing hands back and forth would push every time. Way
  round: at most one push per player per board per day, decided in `spec`.
- **Privacy.** A push endpoint is personal data tied to a profile: it goes in the consent
  wording, in account/profile deletion, and in `lib/local-reset.ts`.
- **Consent generalisation.** The replay banner is one card with its own hook; stretching
  it to two steps must not change what a returning player who already answered sees.

## Decided

- Feature key `push`: **requested by the user in so many words** (2026-11-09).
- Track full, appetite a week: decided inline.
- **First launch reads features (user, 2026-11-10):** a brand-new player must hold the public features on their first launch, so the push step can follow the recording card on a first open. Read `my_features` right after the anonymous sign-up in `hooks/use-supabase-auth.ts`. Widens to every public feature — that is what _public_ means.
- Criterion 2 stands as written; `verify` re-walks it with a fresh profile.

## Contract

### Domain words

Used: **record** (player word) / **takeover** (code word, `Takeover`, `board_reigns`), **board**,
**reign**, **feature**, **stack**, **visibility**, **launch** popup, **profile**, **nickname**
(shown whole). Not used: _medal_, _achievement_, _round_.

Introduced — each gains a row in `docs/domain.md` and a one-liner in `CLAUDE.md`:

| Word             | Definition                                                                                                                         | Code                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **push**         | A notification delivered while the app is closed. Never "alert" or "message". The player's word is NOTIFICATIONS (Czech OZNÁMENÍ). | `lib/push.ts`, feature key `push`              |
| **subscription** | One device's address for a push, belonging to one profile. Not a session, not a plan.                                              | `push_subscriptions`, `save_push_subscription` |
| **outbox**       | Pushes owed and not yet sent, drained by the function.                                                                             | `push_outbox`, `drain_push_outbox`             |

Collisions: **announcement** (in-app bar, `lib/announcements.ts`) is not a push — the push says the
same thing to someone who is away. **session** keeps meaning a challenge appearance; a push
subscription is never called one. The step's `denied` is the _player's_ answer; the browser's
own `Notification.permission === 'denied'` is a different, stronger state and is named `blocked`.

### Files

Created:

| Path                                                                       | Responsibility                                                                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `lib/push.ts`                                                              | Contract: `enablePush()`, `disablePush()`, `pushReach()` types; native stub reports `unsupported`.                         |
| `lib/push.web.ts`                                                          | Register-ready check, `pushManager.subscribe`, save/drop RPC calls.                                                        |
| `lib/push-reach.ts` + `.test.ts`                                           | Pure: `ready` \| `install` \| `blocked` \| `unsupported` from an env snapshot (iOS, standalone, API presence, permission). |
| `lib/push-consent.ts` + `.test.ts`                                         | Pure: parse stored answer; `pushStepDue({ held, replay, push, dismissed })`.                                               |
| `hooks/use-push-consent.ts`                                                | Sibling of `use-replay-consent`: stored answer, `allow`/`decline`/`dismiss`, applies to `lib/push`.                        |
| `components/overlays/push-consent-overlay.tsx`                             | The step: a `ModalCard` shaped like `replay-consent-overlay`.                                                              |
| `public/push-sw.js`                                                        | `push` → `showNotification`; `notificationclick` → focus an open client or open `/`.                                       |
| `supabase/migrations/20261109000000_push_subscriptions.sql`                | Tables, RPCs, trigger, RLS — see Data.                                                                                     |
| `supabase/migrations/20261109010000_push_feature.sql`                      | The `push` feature row, stacks, hidden.                                                                                    |
| `supabase/functions/send-push/index.ts` + `message.ts` + `message.test.ts` | Drain the outbox; copy built in en/cs; web-push send; prune dead endpoints.                                                |
| `supabase/tests/push.sql`                                                  | Assertions over the schema, throttle and RLS.                                                                              |
| `docs/push.md`                                                             | Runbook: VAPID keys, secrets, deploy, cron schedule — the user's production steps.                                         |

Modified:

| Path                                               | Change                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `constants/features.ts`                            | `'push'` key and comment.                                                                      |
| `constants/storage.ts`                             | `PUSH_CONSENT_KEY = 'nine.push-consent.v1'`.                                                   |
| `constants/buttons.ts`                             | `push_consent.allow`, `push_consent.decline`, `options.push_toggle` (match the replay naming). |
| `lib/local-reset.ts` (+ test)                      | PUSH_CONSENT_KEY joins `KEPT_KEYS`, beside the replay answer.                                  |
| `workbox-config.js`                                | `importScripts: ['push-sw.js']`; add `push-sw.js` to `globIgnores`.                            |
| `app/(tabs)/index.tsx`                             | Mount the step after the replay card; pass state to options.                                   |
| `components/overlays/advanced-options-overlay.tsx` | NOTIFICATIONS row beside the replay row.                                                       |
| `locales/*.po`                                     | Via `pnpm i18n:extract`, Czech filled in.                                                      |
| `docs/domain.md`, `CLAUDE.md`                      | The three words above.                                                                         |

### Data and types

- `PushConsent = 'unknown' | 'granted' | 'denied'`, stored under PUSH_CONSENT_KEY. A device with no key is `unknown`.
- **Step rule** (one rule for new and existing players): due when the `push` feature is held, reach is not `unsupported`, replay is **not** `unknown`, push is `unknown`, and not dismissed this session. Closing the card is not an answer — same as replay.
- `push_subscriptions(id, user_id → profiles on delete cascade, platform in web|ios|android, endpoint text unique, p256dh, auth, locale in en|cs, created_at)`. Native rows carry the Expo token in `endpoint`, keys null.
- `save_push_subscription(p_platform, p_endpoint, p_p256dh, p_auth, p_locale)` upserts on `endpoint`, so a re-saved endpoint **moves to the calling profile** (a restore moves a profile onto a device). `drop_push_subscription(p_endpoint)` deletes only the caller's. Both `security definer`, authenticated only. No direct table grants.
- `push_outbox(id, user_id, kind = 'takeover', mode, difficulty, by_nickname, day date, created_at, sent_at)`; **unique `(user_id, mode, difficulty, day)`** is the throttle (day = Prague date). Service role only.
- `after insert on board_reigns` trigger: the previous closed reign on that board is the displaced holder; insert one outbox row (`on conflict do nothing`) when they differ from the new holder **and** hold at least one subscription. `by_nickname` is the new holder's, stored whole.
- `drain_push_outbox(p_limit)` (service role): returns unsent rows `for update skip locked`, joined with subscriptions and locale.
- The function is invoked by pg_cron through pg_net once a minute with a shared secret. The schedule needs the project URL and secret, so it is a **runbook step, not a migration**.
- Code runs against the old schema? **No** — the push must go first; the client calls the RPCs once the feature is held. Existing rows: none touched.

### Copy / i18n

CAN WE TELL YOU WHEN IT HAPPENS? (title) · a prose line (a rival takes a record, nothing else, change it in OPTIONS) · ENABLE / NO THANKS · iOS line "Add nine to your Home Screen first, then come back here" · NOTIFICATIONS row, with states ON / OFF / BLOCKED IN BROWSER · push text (server): "{nick} took your record on {mode} {difficulty}", en + cs, nickname whole. All through Lingui except the push text, which lives in `message.ts` and is covered by its own test.

### Gates

| Gate             | Answer                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **How to Play**  | None — no gameplay change.                                                                                                                         |
| **Flag**         | `push`, **asked for by the user**. Seeded into tester, developer, admin stacks and **hidden**; going public is a visibility flip, not a migration. |
| **Buttons**      | Three new `ButtonId`s listed above.                                                                                                                |
| **Consent copy** | Names the endpoint as personal data held until switched off.                                                                                       |

## Acceptance criteria

1. Without the `push` feature held, no push step shows, the options row is absent, and `lib/push` is never called.
2. With it held on a fresh install, the replay card shows first; answering it brings the push card; neither answer answers the other.
3. With it held on an install that already answered replay and has no push answer, the next startup shows only the push card.
4. ENABLE on web (reach `ready`) prompts for permission from the tap, subscribes, and a `push_subscriptions` row exists for the profile with `platform = 'web'` and the app's locale. NO THANKS stores `denied`, creates no row and never asks again. Closing with the dot stores nothing and asks next launch.
5. The options row turns it off (row deleted, answer `denied`) and on again (resubscribes); when the browser is `blocked` it says so and does not try.
6. `pushReach` returns `install` for iOS outside standalone, `unsupported` with no Push API, `blocked` for denied permission, `ready` otherwise; `install` shows the Home Screen line and no ENABLE; `unsupported` never shows the step.
7. SQL: when B takes a board from A, one `push_outbox` row exists for A naming B's nickname, mode and difficulty — only if A has a subscription; none for B; none when A improves their own record; a second takeover of the same board on the same Prague day adds nothing.
8. SQL: an authenticated user can save and drop only their own subscriptions; re-saving an endpoint under another profile moves it; direct select/insert on both new tables is denied to `anon` and `authenticated`.
9. `send-push` called locally with the secret delivers an outbox row to a web subscription in that subscription's locale with the nickname whole, sets `sent_at`, deletes a subscription the push service answers 404/410, and refuses a call without the secret.
10. After `pnpm build:web`, `dist/sw.js` imports `push-sw.js`; a `push` event shows a notification and a click focuses an open client or opens `/`.
11. `lib/local-reset` keeps PUSH_CONSENT_KEY (a device's answer, like replay), and a granted device saves its subscription again at launch for whichever profile is on it. _(Amended in build: the spec first said cleared; `KEPT_KEYS` is where the replay answer lives and the subscription, not the answer, is per profile.)_
12. `pnpm check`, `pnpm i18n:verify` and `pnpm db:test` are green, Czech included.

## Tests

- `lib/push-reach.test.ts` — the four outcomes across iOS/standalone/permission combinations.
- `lib/push-consent.test.ts` — parse; `pushStepDue` over the full truth table incl. the new-vs-existing cases.
- `lib/local-reset.test.ts` — extended for the new key.
- `supabase/functions/send-push/message.test.ts` — en/cs text, ten-character capitals whole.
- `supabase/tests/push.sql` — criteria 7 and 8.

## Review focus

1. **Two cards at once** — replay and push `visible` must never both be true (task: consent mount).
2. **Shared device** — a restore moves a profile onto a device; the endpoint must follow it, and the old profile must stop receiving (task: save RPC, restore path).
3. **A→B→A takeovers** — "previous closed reign" must pick B's, not A's own (task: trigger).
4. **Flag resolution** — the step must wait for `effective_features`, not fire on the false before it loads and then again (task: consent mount).
5. **Generated worker** — `globIgnores` and `importScripts` must both change, or the precache lists a file it cannot serve (task: workbox config).
6. **Nickname** — stored and shown whole everywhere, including the push body.

## Decided

- Outbox plus once-a-minute drain rather than a database webhook or a trigger calling the network: testable in SQL, no secret inside a trigger, and a minute is fine for this event. Decided inline.
- Throttle one push per player, board and Prague day, as the shape asked. Decided inline.
- The cron schedule, VAPID secrets, function deploy and `db:push` are production writes: they are handed to the user via `docs/push.md`, never run by `build`.
