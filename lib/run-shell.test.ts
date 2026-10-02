import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The chrome around a run belongs to the app, not to whichever engine is running it.
//
// Asserted rather than described, because this is the thing that had already decayed. The
// game machine and arcade each had their own top bar, their own pause screen and their own
// end-of-run screen — four files with the same body — and the copies had drifted: arcade's
// score sat in a framed card while the other two glowed, and arcade never subscribed to
// the one hook that stops a run when the app goes away.
//
// So the rule is that a mode gets this by being a run, not by somebody remembering to wire
// it. These tests are what makes the next engine inherit it too.

// Every screen a run stops or ends on. Multiplayer's two are deliberately absent: they
// describe a *room* — several players, their scores side by side, nobody's own figures —
// so the run shell would be the wrong shape rather than a shared one.
const RUN_SCREENS = [
  'components/overlays/paused-overlay.tsx',
  'components/overlays/game-over-overlay.tsx',
  'components/game/arcade-paused.tsx',
  'components/game/arcade-over.tsx',
]

// Every screen a live run is played on.
const RUN_SCREENS_LIVE = ['app/(tabs)/index.tsx', 'components/game/arcade-game.tsx']

// Everything that owns a run's clock, and so has a run to stop.
const ENGINES = ['app/(tabs)/index.tsx', 'hooks/use-arcade-run.ts']

const read = (path: string): string => readFileSync(path, 'utf8')

describe('the screen a run stops on', () => {
  it('is the shared one, whichever engine the run was on', () => {
    for (const path of RUN_SCREENS) {
      expect(read(path), path).toContain('<RunScreen')
    }
  })

  it('leaves the score readout to the shell', () => {
    // Which is what fixes the frame for good: `ScoreReadout` draws a card when it is
    // given no glow, and the shell derives the glow from the colour so there is nothing
    // left to forget.
    for (const path of RUN_SCREENS) {
      expect(read(path), path).not.toContain('ScoreReadout')
    }
  })

  it('leaves the figures, the button ladder and the scrim to the shell', () => {
    for (const path of RUN_SCREENS) {
      const source = read(path)
      expect(source, `${path} lays out its own stat row`).not.toContain('<StatRow')
      expect(source, `${path} draws its own CTA`).not.toContain('<LinearGradient')
      expect(source, `${path} opens its own screen`).not.toContain('<Screen overlay')
    }
  })
})

describe('the bar a run is played under', () => {
  it('is the shared one on every screen that runs one', () => {
    for (const path of RUN_SCREENS_LIVE) {
      expect(read(path), path).toContain('<RunTopBar')
    }
  })

  it('is the only thing that draws the way to stop', () => {
    // A second pause button is a second answer to where the way out lives.
    for (const path of RUN_SCREENS_LIVE) {
      expect(read(path), path).not.toContain('<PauseButton')
    }
  })
})

describe('a run stops when the app stops being on screen', () => {
  it('is wired by every engine, not by the screens over it', () => {
    // Anything but `active` counts: the app switcher, the notification shade, an incoming
    // call, the screen locking. Every clock in the app is wall-clock, so a run left going
    // behind any of those comes back having lost whatever it was counting.
    for (const path of ENGINES) {
      expect(read(path), path).toContain('usePauseOnBlur(')
    }
  })
})
