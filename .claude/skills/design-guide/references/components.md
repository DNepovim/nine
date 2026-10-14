# Components — what already exists

The rule is **extend, don't fork**. Before writing a component, find the one that is
already doing the job and give it the prop it is missing. A second copy does not read as
a second copy — it reads as a drifted original, and the drift is what the player sees.

The repo has paid for this lesson three times, and each file says so in its own comment:

- **`ModalCard`** — four screens had grown their own dialog, and the install one rose into
  place while news and feedback simply appeared.
- **`RunScreen`** — four files with the same body, and arcade's came to show its score in
  a card while the other two glowed.
- **`CardSection`** — three dialogs each answered the same heading problem differently.

In every case the fix was one component with slots, not a tidier copy.

## The inventory

### Shells

| Need                              | Use                                                               |
| --------------------------------- | ----------------------------------------------------------------- |
| A full-viewport screen            | `components/screen.tsx` — `Screen` / `ScreenLayer`                |
| A dialog                          | `overlays/modal-card.tsx` — `ModalCard`                           |
| A dialog with a keyboard under it | `overlays/card-modal.tsx` — `CardModal`, and only for that reason |
| The screen a run stops on         | `overlays/run-screen.tsx` — `RunScreen`                           |
| A page of the launch popup        | `overlays/popup-card-view.tsx`                                    |

### Inside a card

| Need                     | Use                                                            |
| ------------------------ | -------------------------------------------------------------- |
| A named block of figures | `overlays/card-section.tsx`                                    |
| Label + value rows       | `overlays/stat-row.tsx`, `stat-cell.tsx`                       |
| Tabs                     | `overlays/tab-panel.tsx`                                       |
| A truncated list         | `overlays/show-more.tsx`                                       |
| Loading                  | `overlays/skeleton.tsx`, `skeleton-row.tsx`                    |
| Page indicator           | `page-dots.tsx`, `page-dot.tsx`                                |
| Markdown copy            | `markdown-text.tsx`, `markdown-block.tsx`, `markdown-span.tsx` |
| **A player's nickname**  | **`gradient-name.tsx` — `GradientName`. Always. See below.**   |

### A nickname is never flat ink

**Every nickname the app writes on its own surface goes through `GradientName`.** Not a
`Text` with a token, not an accent colour, not `text-primary` — the component, every
time.

The reason is that a name is not a label, it is an identity: `GradientName` draws it in
the gradient that player's own lifetime averages earn them, so the same person is the
same colour on a leaderboard row, in the winners stripe, in the intro greeting, on their
own profile, and in the sentence naming who leads a challenge. A name drawn flat
anywhere is that player losing their colour on one screen out of nine, which reads as a
different person rather than as a styling slip.

It takes `nickname` plus `avgAccuracy` and `avgSpeed`, both nullable — null is a player
the counters have never seen, which comes out uncoloured rather than wrong. **If the
data you have does not carry the two averages, that is the thing to fix**, not a reason
to fall back to flat ink: the challenge banner needed a migration
(`…_session_leader_factors.sql`) to put them on the one row it draws, and that was the
right trade.

A nested `Text` per character inside one parent `Text`, so it inherits size, weight and
tracking from the caller and still wraps inside a sentence. Style it with `className` as
you would any other text; the per-character colour is set on the children and cannot be
overridden from outside, which is the point.

**Two deliberate exceptions, and only two**: the multiplayer tile and the live corner,
where the name sits on a saturated gradient card and the themed name ink measures about
1.0–1.3:1 against it. Those keep white, and `player-tile.tsx` says so at the call site. A
third exception wants the same treatment — measured, and commented where it is made.

### Pressables

| Need                      | Use                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Any button worth a funnel | `tracked-pressable.tsx` — `TrackedPressable`, with an id from `constants/buttons.ts` |
| The 5-dot menu / close    | `game/menu-button.tsx` — `MenuButton`                                                |
| A checkbox                | `overlays/option-checkbox.tsx`                                                       |
| A slider                  | `overlays/value-slider.tsx`                                                          |
| A mode / difficulty cell  | `overlays/mode-selector.tsx`, `difficulty-selector.tsx`                              |

### A link button carries an icon and no underline

The quiet way out of a screen — CLOSE, RESEND, LEAVE, CHANGE ADDRESS — is a **link
button**, and it looks the same everywhere:

- an **`Ionicons` at `size={10}` in `DIM_INK`**, then
- a **`TYPE.quietAction` label in `text-dim`**, in a `flex-row items-center gap-1`.
- **No underline.**

The icon is what makes it findable without an underline, and that trade is the point: an
underline under 10px small-caps reads as a mis-set label rather than as a link, and in a
column of them the rules stack up into a pattern the eye follows instead of the words. The
icon says _pressable_ in one glyph and leaves the label alone.

`email-code-modal.tsx`'s RESEND and the intro's footer are the reference, and
`publish-scores-button.tsx` is the same voice beside an ask.

Disabled is **opacity**, not a dropped underline — there is no underline to drop. See
`DISABLED_OPACITY` at that call site.

**Eight call sites still wear an underline and no icon**, from before this was written
down: `multiplayer-menu`, `multiplayer-game-over`, `multiplayer-waiting`,
`join-room-overlay`, `tutorial-done-modal`, `account-notice`, `game/step-up-toast` and
`game/arcade-over`. They are a sweep somebody has to agree to, not a thing to fix on the
way past — see the consistency sweep in `SKILL.md`. A _new_ link follows the rule.

`TrackedPressable` is `Pressable` verbatim — props forwarded untouched, `children` as a
render prop included — so swapping the tag changes nothing a player can see. It exists
instead of PostHog autocapture, which would patch touch handling across the whole app,
and the dial is the most touch-sensitive thing in Nine.

## The primary button

`components/primary-button.tsx` — `PrimaryButton` — is the thing a screen is asking you to
press, and the only way to draw one.

It exists because the same button was spelled five ways across nineteen files: two
paddings (`py-3.5` and `py-4`), three radii (`rounded-lg`, `rounded-xl`, `rounded-2xl`),
and an icon variant that re-derived the row for itself. The padding is settled at the
dialogs' `py-3.5`.

```tsx
<PrimaryButton id="compare.close" onPress={close} label={<Trans>CLOSE</Trans>} />
```

| Prop        | For                                                                                   |
| ----------- | ------------------------------------------------------------------------------------- |
| `id`        | Required, from `constants/buttons.ts`. Always tracked — all nineteen were.            |
| `label`     | A node, because nearly every caller has a `<Trans>` to hand.                          |
| `icon`      | Drawn after the label, which puts the button in a row and gives it side padding.      |
| `variant`   | `compact` for a button sitting _inside_ a row next to a field — admin's FIND and ADD. |
| `disabled`  | Dims to `opacity-40` and stops the press.                                             |
| `hitSlop`   | Asked for by the dev screen's RUN, which is small enough to want a bigger target.     |
| `className` | **Placement only** — `mt-*`, `self-center`, a width. Never the shape.                 |

That last row is the rule the component exists to hold: a caller passing `rounded-xl` or
`py-2` through `className` is the drift coming back in through the door.

## Before you add a component

1. **Search for the job, not the name.** The thing you want may be called something else
   — `multiplayer-menu.tsx` is the multiplayer _pause_ screen, not the multiplayer intro.
2. **If something is close, give it a prop.** `ModalCard` gained `replacing`,
   `avoidKeyboard` and `maxHeight` exactly this way, and each prop's comment says which
   dialog asked for it.
3. **If two things genuinely differ, name the difference** in a comment on both. That
   comment is what stops a third one appearing between them.
4. **A prop that only one caller ever passes** is a sign the component is two components.
   That is the one case where splitting beats extending.
