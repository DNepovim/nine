# Taking your profile to another phone — Plan

Spec: docs/work/2026-10-07-account-restore/spec.md

## Tasks

- [x] 1. `constants/` — the `ButtonId`s, `EMAIL_PROMPT_KEY` and `PROFILE_MOVED_KEY` — plus `lib/account-markers.ts`, the four presence touches both markers needed; the spec left their home unsaid. **No feature flag**: one was added here and taken out again on request, along with criterion 13
- [x] 2. `supabase/config.toml` + `supabase/templates/` — Resend as SMTP, the two bodies carrying `{{ .Token }}`, `otp_expiry`, the raised send limit. Settle which template and which `verifyOtp` type the anonymous attach actually uses, against the local stack — Resend stays in the dashboard, not config.toml: nothing here runs `supabase config push`, and the local stack is better on Inbucket. `enable_confirmations` turned **on** — with it off, `updateUser({ email })` sets the address with no code at all
- [x] 3. `lib/account-email.ts` + test — address shape, the Supabase error → `EmailProblem` mapping, the resend cooldown
- [x] 4. `lib/local-reset.ts` + test — `RESET_KEYS` / `KEPT_KEYS` over `constants/storage.ts`, and the wipe
- [x] 5. `lib/app-reload.ts` + `lib/app-reload.web.ts` — `reloadAsync` and `location.reload()`
- [x] 6. `hooks/use-supabase-auth.ts` — the four calls, `email` / `pendingEmail` / `moved`, `onAuthStateChange`, and the refusal-vs-network branch on the launch read — `verifyOtp` tries `email_change` then `signup`, rather than depending on which template Supabase picked
- [x] 7. `components/overlays/email-modal.tsx` — the address card, both purposes, the promise line
- [x] 8. `components/overlays/email-code-modal.tsx` — the six-digit field, resend with cooldown, the restore warning — plus a `sentAt` prop: reopening this off the intro days later must not start a cooldown with nothing to wait out
- [x] 9. `components/overlays/nickname-modal.tsx` — a saved nickname turns the card over to the address step — **no change to the file.** The turn-over is the parent swapping one card for the other, which is what the player sees and is less code than a card that knows about the one after it
- [x] 10. `hooks/use-account-email.ts` + `app/(tabs)/index.tsx` — the flow as one value, wired to the three cards, and the one-time prompt — the two gating decisions came out as module-level pure helpers (`accountNoticeFor`, `mayAskForEmail`), which is also what kept `GameScreen` under the complexity ceiling
- [x] 11. `components/overlays/account-notice.tsx` + `menu-overlay.tsx` — the confirm line and the moved line, under the title — needed a tenth `ButtonId`, `menu.profile_moved`: both notices share the slot but not the action, and one id for two would conflate them in the funnel
- [x] 12. `components/overlays/player-profile-overlay.tsx` — EMAIL and RESTORE PROFILE under `isMine` — threaded through `PlayerProfileProvider`, which gains one `account` prop
- [x] 13. `CLAUDE.md` — three rows in Other key words; `pnpm i18n:extract` and the Czech; `pnpm check` — 32 strings, Czech in the app's own informal register; the two email bodies moved to it too

## Build notes

**What differs from the spec**

- **One platform modal for all three cards** (`components/overlays/card-modal.tsx`, new).
  The nickname card, the address field and the six digits each used to own a `<Modal>`, and
  the hand-over unmounted one while mounting the next in a single commit — which iOS
  answers by dropping the second, so the card that was meant to appear immediately never
  appeared at all. The host now stays put and only its contents change, which also removes
  the exit animation between them. `NicknameModal` lost its `visible` prop as a result.
- **Nothing gates the nickname → address hand-over** but already having an address. The
  earlier carve-out for a pending multiplayer action is gone: a player who typed a name in
  order to create a room now gets the room and the card.

- **One door, not two.** Decided after the build: `sendCode` replaces `attachEmail` and
  `sendRestoreCode`, the address card lost its `purpose`, the code card gained a `branch`,
  and the profile card went from two rows to one. Criterion 8 now says what actually
  happens instead of promising an identical answer either way, and the old criterion 12
  (the "already on another profile" dead end) is gone — that path is the restore now.
  `email.skip` and `profile.restore` were removed from `ButtonId`.
- **SKIP is CANCEL** on the address card. SKIP belongs to the nickname card, where it means
  "carry on without one".

- **No feature flag.** The spec put this behind `restore` at floor `nobody`; that was my
  own addition and it is gone, along with the criterion that tested it. Nothing in the app
  gates these doors now — what gates the feature is whether a sender is configured, which
  is the real gate and the only one.

- **No change to `nickname-modal.tsx`.** The spec had the card turning itself over; the
  parent swapping one card for the other looks identical to the player and leaves the
  nickname card knowing nothing about what follows it. The chain is also narrower than the
  criterion: it fires only when nothing was _waiting_ on the nickname — a player who typed
  one in order to create a room goes into the room.
- **`lib/account-markers.ts` is new and unspecced.** Four presence touches of AsyncStorage
  that the two markers needed and that had no home. No test beside it: there is no pure
  function in it, which is the same arrangement `lib/retired-storage.ts` has.
- **A tenth `ButtonId`**, `menu.profile_moved`. The spec named nine and gave the intro line
  one id, but the line has two meanings and two destinations.
- **`enable_confirmations = true`** in `supabase/config.toml`, which the spec did not name.
  It turned out load-bearing rather than tidy: with it off, `updateUser({ email })` sets the
  address on the spot and the whole confirmation step has nothing to confirm.
- **Resend is not in `config.toml`.** Nothing in this repo runs `supabase config push`, so a
  block there would be documentation that never reaches the server; and the local stack is
  better off on Inbucket, where a code is readable without a verified sending domain. The
  exact dashboard values are written into the file as a comment. **This is a manual
  production step and the feature does not send mail until somebody does it.**

**Decisions taken at a fork**

- **`verifyOtp` is tried as `email_change`, then `signup`.** Which one Supabase wants for an
  anonymous account gaining an address is theirs to decide and ours to be broken by, and
  task 2 could not settle it without a running stack. Both templates are configured and both
  types are tried; the cost is one extra request on a code that was going to be refused.
- **`'expired'` is worded "wrong or has expired".** Supabase answers `otp_expired` for a code
  that was never right _and_ for one that merely sat too long — telling them apart would be
  a way of testing codes — so the line says both rather than inventing a distinction the
  server did not make.
- **The moved line survives launches until it is tapped.** Closing the app is the ordinary
  thing to do when what you opened it for has gone, so an in-memory flag would have lost the
  one player it exists for. The tap is what dismisses it, and it opens RESTORE.

**Left undone, deliberately**

- Nothing in the plan. But `pnpm check` **cannot be claimed green**: this working tree also
  holds an unrelated, in-progress change (`machines/siege.ts`, `components/game/siege-*`,
  `preview-siege.ts`, `docs/work/2026-10-07-arcade-satiety/`) that currently fails both
  `tsc` and `knip` on its own. Everything in this item passes `tsc`, `eslint`, `knip`,
  `vitest` and `i18n:verify` in isolation. `verify` should run the suite on a tree that has
  only this work in it.

## Verification log

_(verify fills this in)_
