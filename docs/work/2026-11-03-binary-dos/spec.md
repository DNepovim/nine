# BINARY in MS-DOS

Slug: binary-dos
Stage: build
Next: /verify binary-dos
Track: small
Branch: feat/binary-dos
Started: 2026-11-03

## Problem

BINARY is about reading a number as bits, and nothing about it looks like a machine that
counts in bits. Its card is a neutral grey, and its run is the ordinary light screen with
its spectrum of colours. The user asked for BINARY to look like MS-DOS: a terminal
before the run, and a run played in DOS blue and white only.

## Appetite

**A day**, decided by the user's request. Everything is a value on the mechanism
challenge-openings shipped (`docs/work/2026-11-03-challenge-openings/`), plus one new
capability: a scheme that is **monochrome**.

## Shape

1. The player starts BINARY (from a session card or the lab).
2. The whole play area is a terminal, from the first frame to the last (user's change after
   seeing it): the screen is in DOS colours, and a white `C:\>` prompt with a blinking
   cursor slowly types `START NINE.EXE`, then a beat for Enter (about 3.7 s; a retry about
   0.8 s; a tap skips the wait). The command stays, in the history at the top.
   **Targets are new lines** rather than discs: the number, and a bar of cells running down
   as its timeout. A hit inverts the line and it goes into the history as `173 OK`; a lost
   one as `173 TIMEOUT`. Every 7 to 15 s the machine types another command at the prompt.
3. The run is played under the **`dos` scheme**: DOS blue ground and white, and nothing
   else. Hearts, target discs and their countdown ring, the keys, the sum row, the score,
   the top bar, the best-scores line and the floating points are all one of the two.
4. A lit bit is a white key with a blue digit; an unlit one is a blue key with a white
   rim and a white digit.
5. BINARY's card on the intro and in the lab is DOS blue.
6. The keys are rounded squares with a heavier foot, like keyboard keys (the scheme's to say).
7. The GAME OVER title appears in the scheme's ink over the game screen, and turns to the
   mode's colours as it flies up and the game-over screen fades in. Any non-`day` scheme.
8. ACCEPT on the challenge dialog runs from black into that challenge's colour, for every
   challenge, with a white label.

Areas: `modes/` (two new kinds, BINARY's entry), `constants/colors.ts` (the `dos`
scheme, the DOS pair), `hooks/use-scheme.tsx` (monochrome), the game components that
draw accents in JS, a new `components/game/openings/terminal.tsx`.

## In / Out / Rabbit holes

**In:**

- `OpeningKind` `terminal`
- `SchemeKind` `dos`, with a `mono` ink that every JS-drawn accent on the game screen yields to
- the scheme may also restyle the keys
- BINARY wired to all of it, with the DOS blue card

**Out:**

- The pause and game-over screens stay as they are (overlays keep their own colours, as
  BLACKOUT's do).
- No DOS font file. "System font" is the app's monospace face, which is what a DOS
  screen reads as. A pixel font would be an asset and a licence question.
- No sound. MINUS stays paused.

**Rabbit holes:**

- **"No other colour" reaches every accent.** The hearts, the countdown ring's blue and
  red, the target discs' band tints, the floating points' red-to-blue and the
  best-scores spectrum are all hard-coded in JS. Way around: one rule, applied once per
  component — `useLegible` answers the scheme's `mono` ink when it has one.
- **The countdown disc needs an inverse**, because the number sits on the ring. Under
  `mono`: disc blue, ring white, number white. A shut or failed disc goes white with a
  blue number.
- **The lit key** is the mode's own gradient today. Under `dos` the scheme supplies the
  key colours.

## Tasks

- [x] 1. `SchemeKind` `dos`; `SCHEMES.dos` (tokens and inks in DOS blue `#0000AA` and white only, `mono`, key palette); `useLegible` answers `mono`; colour test that `dos` is two colours
- [x] 2. Accent sites honour the scheme: heart, pie countdown, target card, best-scores line, score digit, floating points/stat/life-loss, the life-loss flash
- [x] 3. Dial keys take the scheme's key palette and peak when it has one
- [x] 4. `OpeningKind` `terminal` and `components/game/openings/terminal.tsx` (full and short takes, cursor, typed command); the command line is its remains, drawn from the first frame
- [x] 6. The play area is the terminal: `TargetForm` `lines`, `TARGET_FORMS`, `TerminalBoard` and `TerminalTarget`, `lib/terminal-log.ts` (tested); `OPENING_STARTS_LIT`
- [x] 5. BINARY: `opening: 'terminal'`, `scheme: 'dos'`, DOS blue pair; tests; domain rows mention `dos`/`terminal`

## Acceptance criteria

1. `openingOf(challengeId('binary'))` is `'terminal'`, `schemeOf` is `'dos'`, and
   `runRules(..., 'hard').opens` is `true`. BLACKOUT is unchanged, and no other mode
   opens.
2. Every token and ink in `SCHEMES.dos` is `#0000AA` or `#FFFFFF` (a test).
3. Starting BINARY shows the play area as a terminal in DOS colours, typing the command
   slowly. A tap skips the wait. Each target then arrives as a new line with a bar running
   down, and nothing is drawn as a disc. A bar reaching empty costs a life as a ring does;
   a pause stops it. Finished targets and background commands stay in the history, which
   scrolls off the top when full, and the live targets never do.
4. During a BINARY run, everything on the game screen is DOS blue or white: hearts,
   targets and their ring, keys (lit bit white, unlit blue), sum row, score, top bar,
   best-scores line, floating points.
5. BINARY's card in the challenges gallery is DOS blue.
6. An Accuracy run and a BLACKOUT run look exactly as before.
7. `pnpm check` is green for this item's files, Czech included.
8. BINARY's keys are rounded squares; every other mode's are still discs.
9. On BINARY and BLACKOUT the flying GAME OVER title reads on the game screen and lands in
   the mode's colours, with no jump at the hand-off. An Accuracy run's title is unchanged.
10. ACCEPT on the challenge dialog runs `PRIMARY_INK` → `gradientOf(modeId)[1]`; other
    `PrimaryButton`s are unchanged.
