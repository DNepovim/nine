# Install Prompt — Design

Date: 2026-08-11

## Goal

Nine is deployed as a PWA at `https://nine.expo.app`. A player arriving in a
mobile browser has no idea the game can live on their home screen, where it runs
full screen, loses the browser chrome, and keeps working offline — all of which
already work; nothing advertises them.

A popup at launch, modelled on the what's-new dialog, does the advertising. On
Android it installs with one tap. On iOS, where no install API exists, it shows
the two share-sheet steps.

Out of scope: QR-code deep links into a multiplayer room, and Universal Links
into a native build. Both were discussed alongside this and are separate work.

## Behaviour

### Three states

A pure `resolveInstallTarget` maps the browser to one of three targets. The hook
probes `window`/`navigator` and hands it a plain object, so the decision itself
is testable without mocking globals.

| Target           | When                                                    | Body shown         |
| ---------------- | ------------------------------------------------------- | ------------------ |
| `'prompt'`       | `beforeinstallprompt` fired **and** `uaMobile === true` | An INSTALL button  |
| `'instructions'` | iOS Safari, not already installed                       | Two numbered steps |
| `'none'`         | anything else                                           | Nothing renders    |

`'none'` covers more than it looks: already installed, desktop, and every
browser we cannot advise accurately.

### Mobile only, without a UA regex for Android

`navigator.userAgentData.mobile` is present on exactly the Chromium browsers
that fire `beforeinstallprompt`, so desktop Chrome resolves `false` and gets
nothing. No UA sniffing on that path.

iOS needs the regex, because WebKit does not implement UA-CH: iPhone and iPod
match directly, and iPadOS Safari claims to be `Macintosh`, betrayed only by
`maxTouchPoints > 1`.

Chrome, Firefox and Edge on iOS (`CriOS`, `FxiOS`, `EdgiOS`) resolve to
`'none'`. Their steps are nearly identical to Safari's but the toolbar sits
elsewhere, and accuracy was chosen over reach. This is a deliberate, known gap.

### Already installed

`display-mode: standalone`, or `navigator.standalone` on iOS. Either one means
the popup never appears — that is also what makes the launched-from-home-screen
experience free of it.

### Catching the event

`beforeinstallprompt` can fire before React mounts. `app/+html.tsx` gains a
second inline script beside the service-worker one: `preventDefault()`, stash
the event on `window`, dispatch a custom `nine:installable`. The hook reads the
stash on mount _and_ listens for the custom event, so either order works.

The script is not gated on `NODE_ENV`, unlike service-worker registration —
there is nothing to break in dev and gating it would make dev diverge further
from a real build than it already does.

### Dismissal — every launch, always

Plain `useState`. No AsyncStorage, no new storage key: closing hides it for the
session and a reload brings it back.

Tapping INSTALL also hides it. At that point the browser's own dialog has taken
over, and re-showing ours after someone declines that dialog in the same session
is nagging past the point of usefulness. `appinstalled` hides it too.

The consequence to accept: a player who never wants to install sees this on
every visit. That was the explicit choice — install pressure over politeness.

### Not colliding with what's-new

Both want the menu at launch. What's-new wins; install waits for the next
launch, which costs nothing under an every-launch rule.

`useWhatsNew` gains a `ready` flag, set when its storage read finishes on either
branch. The install overlay gates on `whatsNew.ready && !whatsNew.visible`
alongside the same `isMenu && menuOverlay === 'none' && !isMultiActive`
conditions the news popup already uses. Without `ready` the install popup would
paint first and get covered a moment later when the async read resolves.

## UI

The what's-new shell verbatim: `SPECTRUM` gradient border (2px pad, radius 26),
`bg-surface` body, the five-dot `MenuButton` cross to close, and the same
fade-and-scale-to-0.92 exit over 160ms. Header label `INSTALL`, `text-dim` mono
caps at `tracking-[2px]`. No page dots — one screen.

**Hero**, shared by both targets and following `NewsCard`'s grammar without
fabricating a `NewsItem`: a 64px rounded tile tinted `#7273D2` at low alpha
around a `phone-portrait-outline` glyph, the title `ADD TO HOME SCREEN`, then
12px `text-dim` body — "Full screen, no browser bar, and it keeps working
offline."

`#7273D2` is the manifest `theme_color` and the Android adaptive-icon
background, so the popup wears the hue of the icon it is asking for. It is a
mid-tone, so it reads on both `surface` values.

**Android body** — one `bg-strong` pill with `text-on-strong`, label `INSTALL`
and a `download-outline` glyph, at the same geometry as LET'S GO (`rounded-2xl
px-6 py-3.5`). Press calls the deferred event's `prompt()`.

**iOS body** — two numbered rows on `bg-card` pills: "1 · Tap ⎋ in the toolbar"
with Ionicons `share-outline`, which is the real iOS share glyph; "2 · Choose ⊞
Add to Home Screen", where the square-plus is a `border-muted` `View` around an
`add` glyph, Ionicons having no square-plus of its own. Then a `bg-strong` GOT
IT that only closes.

Per the design guide this is a whole-app concern, not a mode one, so it takes
the game scale and the CTA token rather than any `MODE_GRADIENT`.

## Files

```
types/install.ts                        the three targets and the env shape
lib/install-target.ts          + test   env object → target
hooks/use-install-prompt.web.ts         deferred event, visibility, install()
hooks/use-install-prompt.ts             native no-op
components/overlays/install-overlay.tsx the dialog
components/overlays/install-steps.tsx   the two iOS rows
components/overlays/install-step.tsx    one numbered row
constants/colors.ts                   + APP_VIOLET
hooks/use-whats-new.ts                + ready flag
app/+html.tsx                         + the capture script
app/(tabs)/index.tsx                  + wiring
```

The `.web.ts` / `.ts` hook pair follows `lib/supabase.web.ts`: the native file
is a no-op returning `'none'`, so the native bundle never references a DOM API.

No ambient `.d.ts` for the non-standard DOM surfaces (`navigator.standalone`,
`navigator.userAgentData`, the `window` stash). Augmenting `Navigator` and
`Window` needs `interface` merging, which the lint config bans in favour of
`type`. The web hook instead reads them through local structural types with
optional properties — no assertion, and a browser missing them yields
`undefined` rather than a lie.

`APP_VIOLET` joins `APP_BLUE` and `APP_RED` in `constants/colors.ts` rather than
being written as a hex in two components.

Pure logic in `lib/` with Vitest coverage matches `lib/news.ts` and
`machines/scoring.ts`. One component per file per the code guide.

## Testing

`lib/install-target.test.ts`, all plain objects:

- standalone, and iOS standalone via `navigator.standalone` → `'none'`
- iPhone Safari → `'instructions'`
- iPadOS reporting `Macintosh` with `maxTouchPoints > 1` → `'instructions'`
- `CriOS` on an iPhone → `'none'`
- Android Chromium with the event and `uaMobile` → `'prompt'`
- Android Chromium before the event fires → `'none'`
- desktop Chromium with the event, `uaMobile: false` → `'none'`
- `uaMobile: undefined` with no iOS match → `'none'`

## Verifying by hand

Chrome fires `beforeinstallprompt` only with a registered service worker, and
`app/+html.tsx` registers one only in production. **The Android half therefore
cannot appear under `pnpm start`** — it needs `pnpm build:web` and `dist/`
served from localhost (a secure origin), or a deploy. The iOS half has no such
dependency and shows in dev.

## Not touched

No change to controls, targets, timers, modes, difficulty, scoring, streaks or
lives, so `components/overlays/how-to-play-overlay.tsx` stays as it is.
