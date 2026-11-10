# Push notifications — Plan

Spec: docs/work/2026-11-09-push-notifications/spec.md

## Tasks

- [x] 1. (files …040000/…050000: spec's 000000 prefix was taken; feature insert has no `active` column) `supabase/migrations/…push_subscriptions.sql` + `…push_feature.sql` — tables, RPCs, reign trigger, hidden feature row; `supabase/tests/push.sql`; `pnpm db:test`
- [x] 2. (PUSH_CONSENT_KEY went into KEPT_KEYS, spec amended; button id is `options.push_toggle`) `constants/features.ts`, `constants/storage.ts`, `constants/buttons.ts` — the key, the storage key, three button ids
- [x] 3. (isIos exported from install-target.ts to be reused; reach takes a PushEnv snapshot) `lib/push-reach.ts`, `lib/push-consent.ts` and their tests
- [x] 4. (built: dist/sw.js imports push-sw.js, not precached) `public/push-sw.js` + `workbox-config.js`; `pnpm build:web` and check `dist/sw.js`
- [x] 5. (+ lib/push-key.ts for the VAPID bytes, EXPO_PUBLIC_VAPID_PUBLIC_KEY optional in env; native stub also exports refreshPush) `lib/push.ts` / `lib/push.web.ts` — subscribe, save, drop
- [x] 6. (hook also owns the OPTIONS row + toggle, to keep GameScreen under the complexity cap; launchAsksClear helper) `hooks/use-push-consent.ts`, `push-consent-overlay.tsx`, mount in `app/(tabs)/index.tsx` after the replay card
- [x] 7. (local-reset: KEPT_KEYS, done in task 2) Options row in `advanced-options-overlay.tsx`; `lib/local-reset.ts` + test
- [x] 8. (served locally: 401 without key, empty drain 200, claim marks sent. NOT verified locally: a 201 send and the 410 prune — the local edge runtime would not trust a test CA; verify must cover it against a real push service) `supabase/functions/send-push/` + `message.test.ts`; run locally with `supabase functions serve`
- [x] 9. `docs/push.md` runbook; `docs/domain.md` and `CLAUDE.md` rows
- [x] 10. (extract + Czech done; i18n:verify green) `pnpm i18n:extract`, Czech, `pnpm check`

## Reopened by verify (round 1)

- [x] R1. (push.sql green after db reset) `supabase/migrations/…push_subscriptions.sql` — `grant select, delete on push_subscriptions to service_role`; `push.sql` asserts it
- [x] R2. `supabase/functions/send-push/index.ts` — check and log the prune's error
- [x] R3. (featuresFrom helper shared with inspectSession; no unit test — the hook is not unit-tested, verify re-walks criterion 2 with a fresh profile) `hooks/use-supabase-auth.ts` — after `signInAnonymously`, read `my_features` so a first launch holds public features (user's decision, see spec Decided); a test or a fresh-profile walk covers it
- [ ] R4. (still open — environment, not code) Criterion 10 stays NOT VERIFIED until the user's notification environment is sorted; do not claim it

## Build notes

Round 2: R1–R3 landed. `adoptFreshIdentity` (a revoked session replaced by a new anonymous one) still starts with no features — same first-launch gap, left alone as outside this item; worth its own fix.

Differs from the spec:

- Migrations are `20261109040000_…` and `…050000_…`: the spec's `000000` prefix was taken.
- `PUSH_CONSENT_KEY` is in `KEPT_KEYS`, not cleared (criterion 11 amended in spec.md): the answer is the device's, the subscription follows the profile via the upsert, and `refreshPush` re-saves at each launch of a granted device.
- `pushReach` takes `userAgent`/`maxTouchPoints` and asks `isIos` itself (knip ignores `.web.ts`, so the export would have read as unused).
- Hook owns the OPTIONS `row` and `toggle`, and `launchAsksClear` is a module-level helper — both to keep `GameScreen` under the cognitive-complexity cap (baseline was clean).
- tsconfig, eslint and knip exclude `supabase/functions/*/index.ts` (Deno); eslint also ignores `public/*`.
- `docs/push.md` added as the runbook; button ids: `push_consent.allow|decline|later`, `options.push_toggle`.

Left undone / not proven by the build:

- **`send-push` delivery** (201 sent, 410 prune) was not exercised: the local edge runtime would not trust a test CA. Auth (401), empty drain and claim were. Needs a real push service — verify's browser step, or the first deploy.
- **The player-visible flow** (card, options row, a real subscription) has not been driven in a browser. Chrome automation needs the user's agreement.
- Dev fixtures: none added — the feature row is hidden, and a subscription/outbox is written by use, not shown from the database. `pnpm check` fails only on lint errors inside `.claude/worktrees/road-bandits`, which is another session's checkout.

Criteria I believe met by code: 1, 2, 3, 6, 7, 8, 10 (built `dist/sw.js` imports `push-sw.js`), 11, 12 (except `db:test` end-to-end, `push.sql` run alone green). Unproven: 4, 5, 9 (see above).

## Verification log

**Verdict (round 2): 9 PASS, 3 PARTIAL, 1 NOT VERIFIED, 0 FAIL.** Round 1 found two failures (criteria 2 and 9); both fixed and re-walked below.

Round 1 in short: suite green except what predates this work (`pnpm lint` only inside `.claude/worktrees/road-bandits`; `pnpm db:test` red on HEAD too at `features.sql:175`, `challenge_sessions.sql:202`, `session_ratings.sql:279`, `session_run_receipts.sql:180`). Found: first launch held no features, so the push step never followed the recording card (criterion 2); and `service_role` had no DELETE, so dead endpoints were never pruned (criterion 9).

Round 2 suite: prettier, tsc, knip, i18n:verify green; vitest 149 files / 2301 tests; `push.sql` green (now asserts the grant). Browser: real Chrome, local Supabase, throwaway VAPID keys, local `send-push`; Chrome's permission prompt had to be clicked by the user.

| #   | Criterion                                                                             | Result           | Evidence                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Feature off: no step, no row, no calls                                                | PASS             | `push` hidden → `held:false`, no card, OPTIONS shows LANGUAGE but no NOTIFICATIONS row (round 1)                                                                                                                                                              |
| 2   | Fresh install: replay first, then push; neither answers the other                     | PASS             | cleared storage → first launch: tutorial offer, recording card, then the push card; stored `replay:"denied"`, `push:null`                                                                                                                                     |
| 3   | Existing install, feature goes public: only the push card next startup                | PASS             | round 1: replay `denied` stored, `push` made public, reload → push card alone                                                                                                                                                                                 |
| 4   | ENABLE subscribes + saves; NO THANKS stores `denied`, never again; dot asks again     | PARTIAL          | NO THANKS stored `denied`, card gone after reload (PASS). A real Chrome subscription was saved (`web`, `fcm.googleapis.com`, keys, locale). Not observed: the driven tab's own `granted` write (the Allow went to another browser context), and the dot-close |
| 5   | Options row on/off; blocked says so                                                   | PARTIAL          | row present, unchecked, with its description. Toggle on/off and the BLOCKED text not exercised                                                                                                                                                                |
| 6   | `pushReach` outcomes; iOS shows the install line                                      | PARTIAL          | outcomes PASS in `push-reach.test.ts` (incl. iPadOS posing as a Mac); the install card never seen on a device                                                                                                                                                 |
| 7   | Takeover owes the displaced holder, throttled                                         | PASS             | `push.sql`; live: one outbox row naming the taker                                                                                                                                                                                                             |
| 8   | RPCs own-only, endpoint moves, no client table access                                 | PASS             | `push.sql`                                                                                                                                                                                                                                                    |
| 9   | `send-push` delivers in locale, marks sent, prunes 404/410, refuses without key       | PASS             | 401 without key; claim marks sent; FCM accepted 2 real sends; a dead FCM endpoint answered gone and the row is deleted (`subs left: 0`)                                                                                                                       |
| 10  | Built worker imports `push-sw.js`; a push shows a notification; a click focuses/opens | NOT VERIFIED     | `dist/sw.js` imports it (PASS). FCM accepted two real pushes but the user saw no notification, so display and click were never observed. Cause not established — OS or Chrome notification settings, or the worker not running in that context                |
| 11  | local-reset keeps PUSH_CONSENT_KEY                                                    | PASS             | `local-reset.test.ts`                                                                                                                                                                                                                                         |
| 12  | `pnpm check` / `i18n:verify` / `db:test` green                                        | PASS with caveat | green except the pre-existing red above                                                                                                                                                                                                                       |

**For the user before shipping:** criterion 10 is the one thing that says the feature works end to end for a player, and it is unproven. On a clean Chrome profile with notifications allowed for the site (and macOS notifications on for Chrome), take a board from the displaced profile and call `send-push`; or deploy to a preview and try it there.

## Review

`/code-review` (high; the diff touches the schema) gave ten findings; triaged against the spec.

**Fixed in review**

- `save_push_subscription` took any endpoint, and `send-push` POSTs to it holding the service key (SSRF). Now https only, host allowlist (FCM, Mozilla, `*.push.apple.com`, `*.notify.windows.com`), keys required for web; `push.sql` covers http, a foreign host, a lookalike host and missing keys. (The first cut let a plain http address through — `null !~ x` is not true — and the new test caught it.)
- Hiding the `push` feature now stops pushes to existing subscribers (trigger returns early when the feature is `hidden`); tested.
- Permission was asked before a worker was ready, so a fast tap could end with permission granted and nothing subscribed. `enablePush` now waits (5s) for an active worker first.
- `push-sw.js` showed nothing for an empty or unreadable payload, which `userVisibleOnly` punishes; it now always shows a plain line.
- iOS "install first" was offered even in a build with no VAPID key; `pushReach` asks `configured` first.
- `PushRow` was imported from a component into a hook and `EnableResult` declared twice; both now in `types/push.ts`.
- House pass: `claim_push_outbox` broke the domain rule that "claim" names nothing in code → `drain_push_outbox` (migration, test, function, docs).

**Refuted / kept on purpose**

- "Old installed worker has no push handler": the push code ships in the bundle the _new_ worker precaches, so it never runs under an old one.
- Marking an outbox row sent at claim time (a slow or failed send loses that day's push): the spec chose "a duplicate is worse than a miss". Bounded concurrency and a retry counter are a follow-up.
- Notification click ignores the payload URL: it is always `/`.

**Review focus (spec)**: all six confirmed — no double card (`pushStepDue` needs replay answered, plus `!replayVisible`), the endpoint follows the profile (upsert + re-save at launch), A→B→A picks the previous _closed_ reign, the card waits for `loaded` and showed once, `importScripts` and `globIgnores` both changed and the built worker confirms it, nicknames whole with a ten-`W` test.

**Left for their own items**

- A shared consent card: the push card copies the replay card's icon-and-prose markup (the "extend, don't fork" rule). Fix means changing the shipped replay card.
- `launchAsksClear` repeats the replay card's hand-written condition list; one helper for both would be better.
- `push_outbox` is never purged; sent rows are only needed for the day's throttle.
- `adoptFreshIdentity` still starts a replaced identity with no features (same first-launch gap).
- Native iOS/Android and challenge session boards as a trigger (the shape's Out list).

**Not re-verified after the review fixes**: the unit tests, `push.sql`, tsc, lint, knip, the function's 401 and drain pass; the browser ENABLE flow was **not** re-driven after the worker-first reorder, and criterion 10 (a notification actually showing) is still unproven. Both want a human pass on a Chrome with notifications allowed before the feature is made public.

Shipped to `main` as 17a3c27 (server), 26c0d0e (first-launch features), 5ac7543 (client). Migrations **not** pushed to production; feature `push` stays hidden; no deploy.
