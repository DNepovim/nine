# Layout — screens and modals

Two shapes carry almost everything the player sees: a **screen** fills the viewport, a
**dialog** covers one without replacing it. Neither is laid out by hand. Both have a
component that owns the padding, the stacking and the way it arrives, and a new one gets
all of that by filling in slots.

## Screens

`components/screen.tsx`. Two exports, and the difference matters:

| Use                           | What it gives                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<Screen overlay>`            | The standard padding — `px-4 py-2` — and content centred vertically.                                                                                   |
| `<Screen overlay topAligned>` | The same, anchored to the top with `pt-12`.                                                                                                            |
| `<ScreenLayer>`               | The background, the transition and the place in the stack, **no padding**. For the few screens that carry their own: the guide, the archive, a lesson. |
| `<Screen>` (no `overlay`)     | The game, which is not stacked over anything and stays in the flow.                                                                                    |

### Three things a screen must not do for itself

- **Pick a z-index.** The scale is `constants/layers.ts` — `LAYER.screen`,
  `LAYER.dialog`, `LAYER.curtain`, `LAYER.splash`. Two files picking their own 30 and 40
  is how a dialog ends up under the screen it was opened from.
- **Animate its own entrance.** A screen replaces the one before it by appearing
  _underneath_ it, fully drawn, and letting the old one fade off the top. Fading the new
  one in at the same time is what made the game flash between them. `ScreenLayer` knows
  this; a hand-rolled wrapper does not. Pass `overRun` when the screen arrives over a
  live run instead of over another screen — then it does fade, which is what the pause
  screen wants.
- **Re-derive the run-screen shape.** Every screen a run stops on — the pause screen,
  game over, and both of arcade's — is `overlays/run-screen.tsx`. It was four files with
  the same body, which is how arcade's came to show its score in a card while the other
  two glowed. The shape is a head, the number the run was worth, the figures behind it,
  whatever the engine says next, and at the foot one loud way back into a run over one
  quiet way out. Fill the slots.

## Dialogs

`components/overlays/modal-card.tsx` — `ModalCard` — is **every dialog in the app**: the
scrim, the spectrum edge, the surface card, the header with its 5-dot close, and the way
all of it arrives and leaves.

It is one component because four screens had grown their own copy and the copies had
drifted — the install dialog rose into place while the news and feedback ones simply
appeared, which read as two different apps depending on which one you opened.

### The measurements it owns

Width `90%` to a `460` max · radius `26` with a `2`px gradient border · `px-5 pb-5 pt-4`
inside · enter `260ms` rising `18px` · exit `160ms` shrinking to `0.92`.

An entrance played backwards would look like a mistake, which is why it leaves by
shrinking rather than sinking.

### The props that are easy to miss

| Prop            | When                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avoidKeyboard` | The dialog has a field in it. This is an overlay inside the app, not a platform modal, so on iOS the keyboard comes up over it and takes the buttons with it.        |
| `replacing`     | The dialog opens _underneath_ the one it takes the place of. Two scrims fading in opposite directions thin out together and let the game flash between the cards.    |
| `maxHeight`     | The content can run long, so it scrolls inside the card rather than off the display.                                                                                 |
| `titleColor`    | The dialog speaks for the run it was opened from, so it wears that mode's colour. The rest sit back in dim — that is what makes the coloured one read as particular. |

### `children` is a function

`(close) => ReactNode`, not a node. A dialog usually has a second way out — a GOT IT
button, a sent message, an install that closes behind itself. Handing the same `close`
down means those paths play the exit animation instead of unmounting under it.

### The one case for a platform modal

`CardModal` wraps a real `Modal`, and the nickname card is what it holds. A platform
modal is what gets `KeyboardAvoidingView` a window of its own to lift inside.

The cost is real: **a presentation cannot begin while a dismissal is still running**, so
swapping two platform modals in one commit is how iOS came to drop the second. That is
why the address and the six digits moved to `EmailDialog`, which is an ordinary
`ModalCard` — nothing is presented as this one dismisses.

Reach for `ModalCard` unless the keyboard problem is the one you have.

## Composition inside a card

| Need                       | Use                                                                   |
| -------------------------- | --------------------------------------------------------------------- |
| A named block of figures   | `CardSection` — `sectionLabel` over `rounded-2xl bg-card px-3 py-1.5` |
| A row of label + value     | `stat-row.tsx` / `stat-cell.tsx`                                      |
| A page of the launch popup | `popup-card-view.tsx`                                                 |
| Tabs                       | `tab-panel.tsx`                                                       |
| Loading                    | `skeleton.tsx` / `skeleton-row.tsx` — never a spinner                 |

`CardSection` started on the comparison, where a single column of thirteen figures with
one label two thirds of the way down read as thirteen rows of the same thing. The profile
and the medals dialog had the same problem and each had answered it differently. A reader
moving between them is now looking at one document in three places.

## Spacing

The scale is Tailwind's, and the app stays on its rungs: `gap-1` inside a card,
`gap-2`/`gap-3` between blocks, `mb-4`–`mb-8` before a button ladder. A number that is
not on the scale wants a reason.

**Lay out with flex, not with margins on children.** `gap-*` on the parent survives a
child being conditionally rendered; `mb-*` on each child leaves a trailing gap when the
last one is hidden.

## Nothing appears without animating

This app has no hard cuts. Whenever you write a conditional render, decide its entrance
and its exit in the same breath — and the exit needs the view being unmounted to be the
animated one, not a wrapper around it. See the design guide's Motion section.
