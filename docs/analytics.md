# Analytics, feedback and errors

PostHog, on the web build — which is the build players actually get. Behaviour events and
error logging ride on the one SDK; session replay is the piece that deliberately stayed
off. Player feedback does **not** ride on it — it is a Supabase table, for the reasons
below. This documents what shipped, how to configure it, and what was decided against
(for now).

## What shipped

| Piece         | Where                                                                                                                              | What it does                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Event table   | `lib/analytics-events.ts`                                                                                                          | Every event the app sends, with its typed shape. The only place event names are spelled.                         |
| Web client    | `lib/analytics.web.ts`                                                                                                             | `posthog-js`, EU host, autocapture **off**, pageviews off, `capture_exceptions` on, replay off                   |
| Native client | `lib/analytics.ts`                                                                                                                 | No-ops. CI builds no native app, so native carries no SDK — the day it ships, this is the only file that changes |
| Identity      | `identify()` in `app/(tabs)/index.tsx`                                                                                             | The anonymous Supabase user id the boards already rank, so events join to real scores                            |
| Feedback      | `components/overlays/feedback-overlay.tsx`, `lib/feedback-submission.ts`                                                           | A message from the player, written to the `feedback` table with mode, difficulty, score and build attached       |
| Errors        | `capture_exceptions`, `ErrorBoundary` in `app/_layout.tsx`, refusals in `lib/score-submission.ts` and `lib/feedback-submission.ts` | Unhandled errors and rejections, render crashes, and server-refused score and feedback writes                    |

### Feedback is a table, not an event

**Read it in Supabase — `select * from feedback order by created_at desc`.** Not in
PostHog. It shipped as the `feedback_submitted` event and that was wrong twice over:

- `posthog.capture` cannot be awaited and cannot fail out loud, so the dialog printed
  THANK YOU whether or not anything left the device — on native, where analytics is a
  no-op, it always lied.
- Analytics hosts are on every ad-blocker and DNS filter list there is, so the players
  most likely to have something to report are the ones whose message never arrives.

So it writes a row (`supabase/migrations/20260819000000_feedback.sql`) and waits for the
answer. The dialog reaches THANK YOU only for a row the server confirmed, and otherwise
shows a real failure with the message still in the box and a TRY AGAIN. `user_id` is
stamped by the column's `default auth.uid()` rather than sent by the client, so the value
RLS checks and the value in the row cannot disagree. There is no select policy and no
select grant: a player cannot read anyone's feedback, including their own.

**The table is the only place a message goes.** There is no `feedback_submitted` event —
it was deleted rather than slimmed down. Two copies of the same prose in two stores with
different retention is not a design, and in PostHog the copy arrived attached to a person
carrying the player's nickname (`identify`), which is a wider privacy surface than a
free-text box warrants. A refused write is still reported through `captureError` so the
failure is visible, but without the text: the player keeps the only copy, in the box,
to try again.

What this gives up: `screen_opened: { screen: 'feedback' }` still fires when the bookmark
is tapped, so you can see how many players open the dialog — but nothing records how many
of those went on to send, so there is no open-to-submit conversion. Count rows in
`feedback` over the same window if you need the other half.

Feedback opens from a bookmark tucked into the bottom-right edge
(`components/feedback-bookmark.tsx`), present on every screen except a live run. No
screenshot: capturing one means `react-native-view-shot` and a Storage bucket to put the
file in, and the state that goes with the message — board, score, build — already says
what was on screen.

## The events

The list is short on purpose — each one is something a decision could hang on. The
shapes live in `lib/analytics-events.ts`; the wiring is in `app/(tabs)/index.tsx` and
`hooks/use-multiplayer-room.ts`.

- `run_started` — mode, difficulty, and what put the player in: menu, play again, or an
  accepted challenge
- `run_finished` — score, hits, strikes, records taken, celebration screen, personal best
- `challenge_offered` / `challenge_accepted` — both rungs of the ladder: the game-over
  dare and Trainee's step-up toast
- `screen_opened` — options, how to play, news, feedback
- `multiplayer_room` — created / joined / finished, with player count

Feedback sends no event at all — see above. `screen_opened` covers the dialog being
opened; the messages themselves are rows in `feedback`.

Deliberately **not** captured: dial presses. Highest-volume event in the app, and the
aggregate it produces (hits, accuracy) already rides on `run_finished`.

## Configuration

1. **Create the PostHog project.** [app.posthog.com](https://eu.posthog.com) → new
   project → **EU Cloud**. The region is fixed at creation and cannot be moved later
   without a migration, which is why the client defaults to `eu.i.posthog.com`.
2. **Copy the project API key** (Settings → Project → Project API key, starts with
   `phc_`). It is a public key — it ends up in the JS bundle by design.
3. **Production only:** add `EXPO_PUBLIC_POSTHOG_KEY` to the EAS environment the
   deploy workflow runs in (`eas env:create --environment production --name EXPO_PUBLIC_POSTHOG_KEY --value phc_...`,
   or the expo.dev dashboard). `.eas/workflows/deploy.yml` picks it up at `build:web`
   time; it is optional, so `scripts/check-env.js` does not gate on it. Set
   `EXPO_PUBLIC_POSTHOG_HOST` too only if the project is not on EU cloud.
4. **Nothing to set locally.** Two independent switches keep dev and preview quiet:
   no key means analytics is off entirely, and even with a key the client only starts
   when the page is served from the production host (`SHARE_URL`'s domain,
   `nine.expo.app`) — previews on `nine--<id>.expo.app` and localhost never send. A
   key in a local `.env` is harmless. To smoke-test locally, temporarily relax the
   host check in `lib/analytics.web.ts`.
5. **In PostHog, turn on Error tracking** (left nav → Error tracking → enable). The
   client already sends exceptions; this makes the issues view group them.
6. **Verify:** after a production deploy, play a run on `nine.expo.app` and watch
   Activity — `run_started`, `run_finished` and the `build` property on every event.

Dashboards worth making first: a funnel `run_started → run_finished`, retention on
`run_started`, and a trend of `challenge_offered → challenge_accepted`.

## What PostHog also offers (and what is on/off here)

- **Autocapture — off, and this is the important line in the config.** It patches touch
  handling, and the dial is the most touch-sensitive thing in the app.
- **Session replay — off.** It records what is on screen, nickname prompt included;
  turning it on is a consent-banner decision, not a config one. If it ever goes on:
  mask all inputs from day one, sample rather than record everything, and watch web
  frame rate next to Reanimated first.
- **Surveys** — in-app prompts (NPS, "how was this run?") with targeting by event
  history. The feedback overlay covers the free-text case; surveys are the structured
  follow-up if a specific question ever needs asking.
- **Feature flags** — remote on/off switches keyed to the same person ids. The natural
  first user: rolling a new mode or scoring tweak to a slice of players.
- **Experiments (A/B)** — flags plus significance testing, e.g. two versions of the
  challenge copy against `challenge_accepted`.
- **Web analytics** — a ready-made dashboard, but it feeds on pageviews, which are off
  (one route — it would report one screen forever). The events answer more anyway.
- **Insights, funnels, retention, paths, cohorts, HogQL** — the analysis layer over the
  events; needs nothing extra instrumented.
- **Alerts / webhooks** — worth having for the events that are here. Not for feedback,
  which sends no event: that wants a **Supabase database webhook on `feedback` inserts**,
  which is also the only kind that fires for a player whose browser blocks analytics.
  Without one, feedback is only seen when someone thinks to run the query.

## Privacy

- Nicknames are player-chosen and public on the boards; scores are already public.
  Events are keyed to an anonymous id. Little here is sensitive.
- EU hosting is the default in the client and should match the project (step 1).
- The honest reading of GDPR is that even anonymous-id events want a consent banner;
  replay unquestionably does. That decision is still open — revisit before replay, or
  before the audience makes it matter.

## If native ships

`lib/analytics.ts` is the only file that changes: swap the no-ops for
`posthog-react-native` (plus its `expo-*` peers) behind the same four functions. Every
call site already talks to that signature.
