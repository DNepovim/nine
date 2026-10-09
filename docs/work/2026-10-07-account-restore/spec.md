# Taking your profile to another phone

Slug: account-restore
Stage: shipped
Skipped: verify, review
Next: /deploy — on `main`, not live; the Supabase sender must be configured first
Track: full
Branch: feat/account-restore
Started: 2026-10-07

## Problem

A player's whole career — every score, medal, reign, achievement and the fortune they
add up to — hangs off an anonymous session in that one device's storage. Clear the
browser, lose the phone, buy a new one, and there is nothing to say who you were: the
app signs you in as a stranger and your name belongs to a profile you can no longer
reach. Nothing in the app asks for the one thing that would let it find you again.

## Appetite

**A week.** New domain words, an account that changes kind, a transport the repo has
never had, and copy on four screens. The appetite is the input: everything in **Out**
below was cut to make the rest of it fit, and if the shape stops fitting, more goes
there rather than the week growing.

## Shape

Supabase already owns most of this, which is what makes a week plausible. An anonymous
user gains an address with `auth.updateUser({ email })` and is **promoted to a permanent
account only when the address is confirmed**; a device with no session gets the profile
back with `auth.signInWithOtp({ email, shouldCreateUser: false })`. No table, no tokens,
no expiry logic of our own. Four decisions were taken before this was written, each one
buying a slice of the appetite back:

- **Six-digit codes, not links.** A confirmation link has to deep-link into a native
  app on three platforms — scheme handling, `detectSessionInUrl`, the lot. A code typed
  into the app needs none of it, and the repo already draws exactly this input for
  multiplayer (`code-keyboard.tsx`, `game-code-input.tsx`).
- **Adopt, don't join.** Restoring signs you in _as_ the old profile and abandons the
  throwaway anonymous one. Merging two careers means two sets of per-board bests, two
  `earned_at` for one achievement, a fortune to recompute — a week on its own, for a
  result the player cannot tell apart.
- **Resend as Supabase's SMTP**, not a sender of our own. Supabase's templates, Supabase's
  tokens, and it lifts the two-emails-an-hour cap the built-in sender imposes.
- **A restore moves a profile, it does not copy it.** The player's rule, kept: the
  restoring device calls `signOut({ scope: 'others' })`, and the old one finds out on
  its next token refresh.

### The walk

1. A new player finishes a run worth a name and meets **CHOOSE A NICKNAME** as they do
   today. Saving it no longer closes the card — it turns over to a second step: _Add an
   email and you can get this profile back on another phone._ An address, or SKIP. The
   line under it says the address is for getting the profile back and nothing else, no
   mail we ever send for any other reason. That line appears on every card here.
2. Typing one sends a code and swaps the card for six slots. Six digits and the address
   is confirmed; the account quietly stops being anonymous. SKIP, and the player is back
   where they were with no address and nothing broken.
3. A player who already has a nickname and no address meets that second step on its own,
   once, on the next launch. Dismissing it is the end of it — the door stays open on the
   profile card.
4. Between an address being given and a code being typed, the **intro** carries one quiet
   line under the title: _CONFIRM YOUR EMAIL_ and a tap that reopens the six slots. It is
   the only nag, and it goes when the code does.
5. The player's own profile card — the one that already knows `isMine` and offers them
   their motto to write — gains one row: **ADD AN EMAIL**, or **EMAIL** with the confirmed
   address under it once there is one.
6. There is no second door. Adding an address and fetching a profile back are the same
   act from the player's side — _this is me_ — so there is one field, and the server
   decides what the address meant. Free, and it goes on the account in hand. Taken, and
   the card that follows says so: _this address already has a profile — almost certainly
   yours_, and the code brings it here.
7. On that branch, and only that branch, the player reads what it costs before the code is
   submitted: this profile moves here, it leaves the device it was on, and anything played
   on _this_ device under another name stays behind. Confirm, and they are themselves again
   — the server's profile, the server's scores, every local store wiped and rehydrated
   under the right id.

### Areas

- **`hooks/use-supabase-auth.ts`** — the centre of the work. Gains the address and whether
  it is confirmed, the three calls (attach, send, verify), and an `onAuthStateChange`
  listener it has never had, because a restore elsewhere can now end this session.
- **`components/overlays/nickname-modal.tsx`** plus two or three new cards — the email
  step, the six slots, the restore warning.
- **`components/overlays/menu-overlay.tsx`** — the unconfirmed line on the intro.
- **`components/overlays/player-profile-overlay.tsx`** — the two rows under `isMine`.
- **`app/(tabs)/index.tsx`** — the one-time prompt for players who already have a name,
  and the wiring, as it already owns `showNicknameModal`.
- **Local stores** — `use-local-scores`, `achievement-store`, `use-persisted-stats`,
  `use-saved-run` and friends all belong to the device's _old_ player. A restore has to
  clear them. See the rabbit holes; this is the sharp edge, not the auth.
- **Supabase config** — `supabase/config.toml` and the dashboard: SMTP pointed at Resend,
  `enable_confirmations`, OTP length and expiry, the rate limits, the templates.
- **No schema change.** The address lives in `auth.users` and comes back on
  `auth.getUser()`. `profiles` is untouched.
- **Copy** — every string extracted and translated, and How to Play gains a short
  paragraph: this is the first thing in the app that outlives the device.

### Mode or engine, and the flag

Neither, and **no flag**. Nothing here is a run, so no rules and no capability; and this
ships to everyone the day it ships rather than hiding behind a `constants/features.ts`
key. What gates it instead is the transport: with no SMTP sender configured, no code is
sent, and the card says so. A flag would not have added a gate — only a second one in
front of the real one.

## In

- Email as an optional second step of the nickname card, and as a one-time card for
  players who already have a name.
- Confirmation by six-digit code; the unconfirmed line on the intro until it is typed.
- One row on the player's own profile card, which is the same door under both names.
- Restore by code: adopt the old profile, revoke the other device, wipe local state.
- The warning before a restore, and the "only ever for this" line on every email card.
- Resend wired in as Supabase's SMTP, with the templates it sends.

## Out

Named so they are not built by accident:

- **Merging two profiles.** The abandoned anonymous account is left where it is.
- **Passwords, Apple or Google sign-in.** An address and a code is the whole of it.
- **Changing or removing a confirmed address.** One address, once. A player who typos one
  and confirms it anyway is a support case this week, not a screen.
- **Deleting an account by email.** Real, and a separate piece of work.
- **Links as a second channel.** Codes only, on every platform including web.
- **Two devices at once, or an explicit sign-out.** A profile is on one device by
  construction; there is no LOG OUT button and nothing asks for one.
- **Localised email bodies**, if the rabbit hole below is taken the cheap way.

## Rabbit holes

- **Local storage after a restore — the real one.** Scores, achievements, stats and a
  saved run are all on the device and all belong to the player being walked away from. Left
  alone, the achievement sync pushes a stranger's history up into the restored profile and
  the local board shows scores that are not theirs. _The way around:_ one function that
  names every store and empties it, called before the restored session is read, and a
  rehydrate from the server after. If this turns out to touch more than a handful of keys,
  it is the thing that makes the week not fit — cut the one-time prompt for existing
  players first.
- **Email templates are not locale-aware.** Supabase sends one body per template and knows
  nothing of the player's locale. _The way around:_ one bilingual body, English above
  Czech, and no templating. If that reads badly, English only and a note; translated mail
  is not worth a custom sender.
- **The revoked device.** Device A learns it has been signed out at its next token refresh
  — within the hour, or at its next launch. The hook has to meet that without dumping the
  player into a silent new anonymous identity: it needs to say what happened. _Way around:_
  one line on the intro, the same slot the unconfirmed notice uses.
- **`is_anonymous` in RLS.** Promoting an account changes that claim. Checked while
  shaping: nothing but `seed.sql` mentions it, so no policy's meaning moves under this —
  but it is one grep, and `spec` should run it again rather than trust this line.
- **An address already on another profile.** _(Resolved by the merge, and this is the hole
  it fell into.)_ `updateUser` rejects it, and the rejection was going to be a dead end read
  by the one person it was least useful to — the owner of that profile, trying to get it
  back. It is now the signal that routes them to it. What this hole was really guarding
  against, a way of testing which addresses exist, is no longer guarded: see criterion 8.
- **Rate limits.** Two per hour is the built-in sender's; Resend's is ours to set. A player
  who mistypes twice must not be locked out of their third try, and the RESEND button needs
  a cooldown the card can show.

## Hand-off

`Next: /spec account-restore` — names the types, the files, the copy, the gates and the
numbered acceptance criteria, and breaks it into plan.md.

---

## Contract

Three corrections to the shape, found by reading the code rather than by thinking about
it, and each one makes the week fit better:

- **No keypad for the code.** `CodeKeyboard` is nine keys with no zero and no backspace —
  it exists for a 4-digit room code and cannot type an OTP. Rather than fork it, the code
  goes into one `TextInput` with `keyboardType="number-pad"`. That buys back the two
  things a custom keypad forbids: pasting the code out of the email, and iOS filling it
  from the notification banner (`textContentType="oneTimeCode"`). One fewer component,
  one fewer rabbit hole.
- **A restore ends in a reload.** Every persisted hook — scores, achievements, career,
  stats, the saved run — hydrates once on mount from AsyncStorage. Clearing the keys under
  a live tree leaves every one of them holding the old player's numbers in memory. The
  honest fix is `expo-updates`' `reloadAsync` (and `location.reload()` on web, which the
  repo already has a `.web.ts` precedent for in `lib/update-reload.ts`). Wipe, then reload,
  and rehydration is not a problem that exists.
- **One door, not two.** _(Decided after the build, and it replaces the shape's seventh
  beat.)_ The attach and restore flows are one field. The commonest way the old attach
  flow failed was a player who already had a profile on another phone typing the address
  they already use and being told it belonged to somebody else — it was theirs. `sendCode`
  tries `updateUser` first and reads `email_exists` as "go and fetch that profile", so the
  likeliest failure became the thing they came for. The cost is named under criterion 8:
  the app can now be asked whether an address has an account. Supabase's API already
  answers that to anyone holding the public anon key, so nothing is newly exposed — but we
  have stopped deliberately hiding it, and that was a conscious trade.
- **How to Play is not touched.** The gate asks about controls, targets, timers, modes,
  difficulty, scoring, streaks and lives. This is none of them. The shape said the guide
  would gain a paragraph; it should not — the explanation belongs on the card that is
  asking for the address, where the player actually is.

### Domain words

**Used, as `CLAUDE.md` already defines them:** profile, board, medal, achievement,
fortune, intro, run. Nothing here is a mode, a run or a rule, so `RunRules`, `traitsOf`
and the registry are untouched.

**Introduced** — three, and `CLAUDE.md`'s Other key words table gains a row for each:

| Word        | Means                                                                                                                                                                                                                                             | Code                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **address** | The email a profile can be reached at. One per profile, given once. **Pending** until the code is typed, **confirmed** after — and only a confirmed one can restore anything.                                                                     | `email` / `pendingEmail` in `use-supabase-auth` |
| **restore** | Bringing a profile onto this device from its address. A **move**, not a copy: the device it was on loses it. The verb the player reads, and the verb in code.                                                                                     | `restoreProfile`, `lib/account-email.ts`        |
| **account** | The `auth.users` row under a profile. A code word, never shown: a player has a **profile**, and the button says ADD AN EMAIL. The two differ in exactly one way worth naming — an account starts anonymous and becomes permanent at confirmation. | `auth.users`, `is_anonymous`                    |

**Collisions, and how they stay apart:**

- **code.** Multiplayer already has one: four digits, typed to join a room, drawn by
  `game-code-input.tsx` on a keypad of its own. This one is six digits, arrives by email
  and confirms an address. Always qualified in copy — _confirmation code_ here, _room
  code_ there — and the components never meet: this one has no keypad at all.
- **restore.** `20260924010000_profile_read_restore.sql` uses the word for putting three
  dropped columns back into a function. Historical, in a filename, and nothing reads it.
  No rename.
- **account** vs the two **admins**. Unrelated to both the room host and the role; the
  word is not used for either and must not start being.

### Files

**Created**

| Path                                       | Responsibility                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `lib/account-email.ts`                     | Pure: the shape an address must have, what a Supabase auth error means in words, the resend cooldown. |
| `lib/account-email.test.ts`                | Colocated test.                                                                                       |
| `lib/local-reset.ts`                       | Which AsyncStorage keys a restore wipes and which it keeps, and the wipe itself.                      |
| `lib/local-reset.test.ts`                  | Colocated test — the one that fails when a future key is added and nobody decides.                    |
| `lib/app-reload.ts`                        | Restart the app after a restore. Native: `expo-updates`' `reloadAsync`.                               |
| `lib/app-reload.web.ts`                    | The web variant: `location.reload()`. Same split `lib/update-reload.ts` already uses.                 |
| `hooks/use-account-email.ts`               | The flow as one value — which card is up, for which purpose, and the four calls behind them.          |
| `components/overlays/email-modal.tsx`      | The card that asks for an address. One field, no purpose — the server decides what it meant.          |
| `components/overlays/email-code-modal.tsx` | The card that takes the six digits — resend with its cooldown, and the restore warning above the CTA. |
| `components/overlays/account-notice.tsx`   | The one line under the intro's title: confirm your address, or this profile moved to another device.  |
| `supabase/templates/confirm-email.html`    | The body that carries the attach code.                                                                |
| `supabase/templates/magic-link.html`       | The body that carries the restore code.                                                               |

**Modified**

| Path                                             | What changes                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/use-supabase-auth.ts`                     | The centre. Gains `email`, `pendingEmail`, `moved`, and `sendCode` / `confirmEmail` / `restoreProfile`. Gains an `onAuthStateChange` listener, and a refusal-vs-network branch on the launch read. |
| `components/overlays/nickname-modal.tsx`         | A saved nickname turns the card over to the address step instead of closing it.                                                                                                                    |
| `components/overlays/menu-overlay.tsx`           | Renders `AccountNotice` under `TitleSlot`.                                                                                                                                                         |
| `components/overlays/player-profile-overlay.tsx` | One row under `isMine`: ADD AN EMAIL, or EMAIL with the address.                                                                                                                                   |
| `app/(tabs)/index.tsx`                           | Wires `use-account-email` to the three cards, and fires the one-time prompt.                                                                                                                       |
| `constants/features.ts`                          | The `restore` key.                                                                                                                                                                                 |
| `constants/buttons.ts`                           | The new `ButtonId`s.                                                                                                                                                                               |
| `constants/storage.ts`                           | `EMAIL_PROMPT_KEY`, `PROFILE_MOVED_KEY`.                                                                                                                                                           |
| `supabase/config.toml`                           | SMTP pointed at Resend, the two templates, `otp_expiry`, the raised `email_sent` limit.                                                                                                            |
| `CLAUDE.md`                                      | Three rows in Other key words.                                                                                                                                                                     |

### Data and types

**No migration.** The address lives in `auth.users` — `email`, `new_email`,
`email_confirmed_at`, `is_anonymous` — all of which ride on the session user the hook
already awaits. `profiles` is untouched, no RLS policy reads `is_anonymous` (grepped:
only `seed.sql` mentions it), and the code runs against today's schema unchanged. Nothing
has to be pushed before a deploy.

What `useSupabaseAuth` returns gains four fields and four calls:

```ts
type AuthState = {
  // …as today: userId, nickname, features, isReady, updateNickname
  email: string | null // confirmed, or null
  pendingEmail: string | null // given, not yet confirmed
  moved: boolean // this device's session was revoked by a restore elsewhere
  // One field, one call. `branch` is 'attach' | 'restore', and is null whenever `error` is
  // not — nothing was sent, so there is nothing for the next card to be about.
  sendCode: (
    address: string,
  ) => Promise<{ error: EmailProblem | null; branch: EmailBranch | null }>
  confirmEmail: (code: string) => Promise<{ error: EmailProblem | null }>
  restoreProfile: (code: string) => Promise<{ error: EmailProblem | null }>
}
```

`EmailBranch` is `'attach' | 'restore'` — not an input, a result. `EmailProblem` is the
union the modal draws a line from, exhaustive over what the two cards can meet — `'shape'`, `'taken'`, `'bad_code'`, `'expired'`, `'rate_limited'`,
`'offline'`, `'unknown'`. The mapping from a Supabase error to one of these is pure and
lives in `lib/account-email.ts` with its test; the hook does the network and nothing else.

`lib/local-reset.ts` holds two lists over the keys in `constants/storage.ts`:

```ts
export const RESET_KEYS = [...]  // the previous player's: scores, career, achievements, stats, run, medals, winnings…
export const KEPT_KEYS  = [...]  // the device's own: locale, replay consent, seen news, how-to-play read
```

Split on one question: _does this belong to the player or to the phone?_ The locale a
player set and the consent they gave are the phone's and survive; everything that is a
record of play is the old player's and goes. The test asserts the two lists together
cover every key `constants/storage.ts` exports — so the next key added fails the suite
until somebody chooses a side, which is the whole reason the lists are written out rather
than derived.

**Two new storage keys**, neither versioned on a shape because both hold one scalar:

- `nine.email-prompt.v1` — set when the one-time prompt is dismissed or answered. Gates
  only the **prompt**, never the pending-confirmation line.
- `nine.moved.v1` — set when the hook sees its session refused rather than unreachable.
  Read once by the intro and cleared, like `consumeUpdateReload`.

**Supabase config**, which is the one thing that is not code. In `config.toml` for the
local stack and in the dashboard for production:

| Setting                            | Value                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `auth.email.smtp`                  | Resend — `smtp.resend.com:465`, user `resend`, pass `env(RESEND_API_KEY)`   |
| `auth.email.template.confirmation` | `./supabase/templates/confirm-email.html`, carrying `{{ .Token }}`          |
| `auth.email.template.magic_link`   | `./supabase/templates/magic-link.html`, carrying `{{ .Token }}`             |
| `auth.email.otp_length`            | `6` — the code card has six frames and accepts nothing longer               |
| `auth.email.otp_expiry`            | `600` — ten minutes. An hour is a long time for a code sitting in an inbox. |
| `auth.rate_limit.email_sent`       | raised off `2`; the built-in sender's cap is what that number is for        |

Build's first task is to settle, against the local stack, **which** template Supabase
sends for an anonymous user's `updateUser({ email })` — the confirmation or the email
change — and which `type` `verifyOtp` wants back. Configure both templates either way;
a template without `{{ .Token }}` sends a link the player cannot use.

### Copy, and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | Thirty-odd strings, all through Lingui and all into Czech: the two card titles and their blurbs; **the promise line** — _Only ever used to get your profile back. No newsletters, no offers, nothing else — ever._; SEND CODE / SEND ANOTHER / CONFIRM / RESTORE PROFILE / CANCEL; the line that explains a restore to somebody who only typed their address, and the two-sentence warning under it; seven error lines, one per `EmailProblem`, of which `taken` never renders; the intro's two notices; the profile row and its sub-line. The email bodies are **not** Lingui — see the rabbit hole. |
| **How to Play** | **None.** Not controls, targets, timers, modes, difficulty, scoring, streaks or lives. The shape's line about a new paragraph is withdrawn.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Flag**        | **None.** Every door — the two profile rows, the nickname card's second step, the one-time ask, the intro's confirm line — is open to everyone from the first build that carries them.                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Buttons**     | Seven new `ButtonId`s: `email.send`, `email.cancel`, `email_code.confirm`, `email_code.resend`, `email_code.cancel`, `profile.email`, plus `menu.confirm_email` and `menu.profile_moved` for the intro's two notices. `email.skip` and `profile.restore` were written and then removed — one door needs neither.                                                                                                                                                                                                                                                                                      |

## Acceptance criteria

1. A player with no nickname who finishes a scoring run meets **CHOOSE A NICKNAME** as
   today; saving a valid one turns that card over to the address field rather than closing
   it. CANCEL there closes the card and stores no address.
2. The address card carries the promise line — used only to get the profile back, no other
   mail ever — wherever it was opened from: the nickname card's second step, the one-time
   ask, the profile row, and the moved line on the intro.
3. **An address nobody has** is attached: pressing SEND CODE swaps the card for the
   six-digit field, `auth.getUser()` then has `new_email` set and `email` still null, and
   no row in `profiles` has changed. A malformed address is refused before any request is
   made.
4. Typing the six digits confirms it: `auth.getUser()` has `email` set,
   `email_confirmed_at` non-null and `is_anonymous` false. The card closes; the player's
   nickname, scores and medals are exactly what they were.
5. A player who already has a nickname and no address meets the address card once, on the
   next launch. Dismissing it writes `nine.email-prompt.v1`, and it never appears again —
   on that launch or any other.
6. While an address is pending, the intro carries **CONFIRM YOUR EMAIL** under the title;
   tapping it reopens the six-digit field. It goes the moment the code is accepted and does
   not return. A player who skipped the ask and later added an address still gets this line
   — the prompt marker does not gate it.
7. The player's own profile card shows **one** row: **ADD AN EMAIL**, with a line under it
   naming both halves of what it does, or **EMAIL** with the confirmed address once there
   is one. Nothing of the sort appears on anybody else's profile.
8. **An address that already has a profile** does not dead-end. The same SEND CODE sends a
   sign-in code to it, and the card that follows says the address already has a profile and
   that the code brings it here. The flow never creates a second account for an address: a
   free one goes on the account in hand, a taken one routes to the profile already on it.
   _(This replaces the earlier promise that the restore field answered identically either
   way. It no longer does, so the app can be asked whether an address has an account — a
   trade taken knowingly, since Supabase's API already answers that to anyone holding the
   anon key.)_
9. On that branch and no other, the card states both costs before the code is submitted:
   this profile leaves the device it was on, and anything played on **this** device under
   another name stays behind. Confirming restores: the session is the other profile's,
   every key in `RESET_KEYS` is absent from AsyncStorage, no key in `KEPT_KEYS` was touched,
   and the app reloads to the intro greeting the restored nickname.
10. A `verifyOtp` that fails — wrong code, expired code, no connection — leaves the device
    exactly as it was: the old session, every key intact, no reload, and a line on the card
    naming which of the three happened.
11. The device the profile was taken from loses it **the next time it is looked at** — on
    its next launch, or on the next time it is brought to the foreground — because it asks
    the auth server whether its session still exists rather than waiting to be told. A
    refused refresh is only the third way the news can arrive, and the slowest: it waits on
    the access token running down, and until then PostgREST answers that device's reads and
    writes perfectly normally. Whichever way it arrives, it signs in anonymously and the
    intro says the profile moved to another device. A device that is merely offline keeps
    its session and says nothing.
12. `pnpm check` is green, `pnpm i18n:verify` included, and every new string has Czech.

## Tests

| File                                | Covers                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/account-email.test.ts` _(new)_ | The address shape: accepted, rejected, trimmed and lower-cased. Every `EmailProblem` the Supabase error mapping must produce, including the two that are easy to get wrong — `email_exists` → `'taken'`, `over_email_send_rate_limit` → `'rate_limited'` — and an unrecognised error → `'unknown'` rather than a throw. The resend cooldown's remaining seconds, at the boundary. |
| `lib/local-reset.test.ts` _(new)_   | `RESET_KEYS` and `KEPT_KEYS` are disjoint, and together name every key `constants/storage.ts` exports. This is the test that fails when a future key is added and nobody chooses a side — the point of it, not a side effect.                                                                                                                                                     |

No UI tests. The three cards are a field, a button and a line of copy each; what is worth
checking about them is on the criteria above, which `verify` drives in the real app.

## Review focus

Five things the contract implies that no happy path would catch:

1. **The prompt marker gating too much.** `nine.email-prompt.v1` answers one question —
   has this player been _asked_ — and criterion 6 depends on it answering no others. The
   natural bug is one `if` covering both the prompt and the confirm line, which silences
   the line for everybody who ever skipped. _Task 10 owns this._
2. **The order of the restore, and what happens when a step fails.** New session →
   `signOut({ scope: 'others' })` → wipe → reload, and the wipe must be unreachable from
   any path where `verifyOtp` did not succeed. The revoke is the one step allowed to fail
   quietly — a restore done offline-ish still has to complete, and the old device simply
   keeps the profile a while longer. Say so in a comment rather than leaving the next
   reader to guess whether the missing `await` was deliberate. _Task 6._
3. **The window between the new session and the reload.** For a few hundred milliseconds
   the app is signed in as the restored player with the previous player's state still in
   memory — `identify()`, the score submitter, the achievement sync all key on `userId`.
   Nothing may write in that window. The cheapest guarantee is that `restoreProfile` never
   returns to a render that has the new id; check that it does not. _Task 6._
4. **Two ways to lose a session, one of which is not a refusal.** The launch read already
   signs out when the profile row is missing. The new branch signs out when the refresh is
   refused. They share an ending — an anonymous sign-in — but only the second sets
   `nine.moved.v1`, and `isNetworkFailure` is what keeps an offline launch out of both.
   Getting this wrong tells a player on a train that their profile moved. _Task 6._
5. **Nothing here may depend on the player reaching a door.** With no flag in front of it,
   every path is live for everyone on the first launch of the build that carries it —
   including the one-time ask, which fires by itself. Check that it cannot fire over the
   nickname card, over a launch popup, or mid-run. _Tasks 10 and 11._
