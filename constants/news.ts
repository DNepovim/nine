import { msg } from '@lingui/core/macro'

import type { Release } from '@/types/news'

// Everything ever announced, newest release first. Adding an entry here is the
// whole act of announcing something — the popup and the archive both read it.
//
// Item ids are permanent: reword a title freely, but never reuse an id for a
// different announcement or players who already saw the old one will miss it.
export const RELEASES: Release[] = [
  {
    date: '2026-09-17',
    items: [
      {
        id: 'achievements',
        icon: 'trophy',
        // The achievement green, not a mode colour: gold is a record you hold, green
        // is one you keep — see the design guide.
        accent: '#1E9448',
        title: msg`Things you keep`,
        body: msg`A record is only ever lent — someone takes it back eventually. Achievements are the other kind: earned once and yours for good, measured against nobody but yourself. Some are waiting where you would not think to look.`,
      },
    ],
  },
  {
    date: '2026-08-18',
    items: [
      {
        id: 'feedback-bookmark',
        icon: 'chatbox-outline',
        accent: '#4C7EFF',
        title: msg`Tell me what you think`,
        body: msg`There is a little FEEDBACK tab tucked into the bottom-right corner, on every screen except a live run. Anything goes — what broke, what annoyed you, what you wish the game did. It lands straight with the person who makes Nine, and it is read.`,
      },
    ],
  },
  {
    date: '2026-08-17',
    items: [
      {
        id: 'champion-marks',
        icon: 'ribbon',
        accent: '#FF8C00',
        title: msg`Marks for the hardest boards`,
        body: msg`Take the all-time record on a mode’s Extreme board and you carry its mark beside your name everywhere — an owl for Accuracy, an eagle for Speed, a crown for both. Take one and the game over screen celebrates it properly.`,
      },
    ],
  },
  {
    date: '2026-08-13',
    items: [
      {
        id: 'trainee-route-hint',
        icon: 'footsteps',
        accent: '#4C7EFF',
        title: msg`See the better way`,
        body: msg`Take the long road to a target and Trainee now shows you the short one — the keys that would have done it, in the order to press them.`,
      },
    ],
  },
  {
    date: '2026-08-12',
    items: [
      {
        id: 'trainee-coach',
        icon: 'school',
        accent: '#4C7EFF',
        title: msg`Trainee coaches you`,
        body: msg`Trainee now says when a move went to waste, and what a hit cost.`,
      },
    ],
  },
  {
    date: '2026-08-11',
    items: [
      {
        id: 'record-celebrations',
        icon: 'sparkles',
        accent: '#FF8C00',
        title: msg`Records, celebrated`,
        body: msg`Beat a record and the game makes a fuss about it.`,
      },
    ],
  },
  {
    date: '2026-08-10',
    items: [
      {
        id: 'gradient-icon',
        icon: 'color-palette',
        accent: '#7273D2',
        title: msg`A fresh face`,
        body: msg`Nine has a new look, and it goes all the way down.

- The icon now carries the same **blue-to-red spectrum** as the splash
- Matching artwork on your home screen, browser tab and app switcher

Same game underneath. It just looks like itself now.`,
      },
      {
        id: 'whats-new',
        icon: 'megaphone',
        accent: '#FF8C00',
        title: msg`Never miss an update`,
        body: msg`This is how Nine will tell you what changed.

- New things show up here next time you open the app
- Been away a while? You'll see **everything you missed**, oldest first
- Past updates live in Options → What’s new`,
      },
      {
        id: 'nine-peak-tint',
        icon: 'color-fill',
        accent: '#E5534B',
        title: msg`Spot your nines`,
        body: msg`The dial tells you more at a glance.

- Buttons still brighten as you dial higher
- **Nine now stands apart** — a dark pill with a warm red digit

No more squinting at the top of the range mid-run.`,
      },
      {
        id: 'best-scores-bar',
        icon: 'trophy',
        accent: '#c36282',
        title: msg`Best scores, up top`,
        body: msg`A thin line above the game now shows your best on this board next to today's, this week's and the all-time high.

It stays out of the way for the first few seconds of a run.`,
      },
      {
        id: 'speed-retune',
        icon: 'timer',
        accent: '#E5534B',
        title: msg`Speed eases off`,
        body: msg`Speed mode was brutal. Now it is merely fast — about half again as long on every target.`,
      },
      {
        id: 'speed-streak',
        icon: 'flash',
        accent: '#c36282',
        title: msg`Speed combos, rebuilt`,
        body: msg`Your Speed combo now grows on every quick hit instead of waiting for a clear board — but a slow one breaks it.

Land a target with most of its ring still full and it pays extra.`,
      },
    ],
  },
]
