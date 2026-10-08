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

### Pressables

| Need                      | Use                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Any button worth a funnel | `tracked-pressable.tsx` — `TrackedPressable`, with an id from `constants/buttons.ts` |
| The 5-dot menu / close    | `game/menu-button.tsx` — `MenuButton`                                                |
| A checkbox                | `overlays/option-checkbox.tsx`                                                       |
| A slider                  | `overlays/value-slider.tsx`                                                          |
| A mode / difficulty cell  | `overlays/mode-selector.tsx`, `difficulty-selector.tsx`                              |

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
