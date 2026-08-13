import type { Release } from '@/types/news'

// Everything ever announced, newest release first. Adding an entry here is the
// whole act of announcing something — the popup and the archive both read it.
//
// Item ids are permanent: reword a title freely, but never reuse an id for a
// different announcement or players who already saw the old one will miss it.
export const RELEASES: Release[] = [
  {
    date: '2026-08-13',
    items: [
      {
        id: 'trainee-route-hint',
        icon: 'footsteps',
        accent: '#4C7EFF',
        title: 'See the better way',
        body: 'Take the long road to a target and Trainee now shows you the short one — the keys that would have done it, in the order to press them.',
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
        title: 'Trainee coaches you',
        body: 'Trainee now says when a move went to waste, and what a hit cost.',
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
        title: 'Records, celebrated',
        body: 'Beat a record and the game makes a fuss about it.',
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
        title: 'A fresh face',
        body: [
          'Nine has a new look, and it goes all the way down.',
          '',
          '- The icon now carries the same **blue-to-red spectrum** as the splash',
          '- Matching artwork on your home screen, browser tab and app switcher',
          '',
          'Same game underneath. It just looks like itself now.',
        ].join('\n'),
      },
      {
        id: 'whats-new',
        icon: 'megaphone',
        accent: '#FF8C00',
        title: 'Never miss an update',
        body: [
          'This is how Nine will tell you what changed.',
          '',
          '- New things show up here next time you open the app',
          "- Been away a while? You'll see **everything you missed**, oldest first",
          '- Past updates live in Options → What’s new',
        ].join('\n'),
      },
      {
        id: 'nine-peak-tint',
        icon: 'color-fill',
        accent: '#E5534B',
        title: 'Spot your nines',
        body: [
          'The dial tells you more at a glance.',
          '',
          '- Buttons still brighten as you dial higher',
          '- **Nine now stands apart** — a dark pill with a warm red digit',
          '',
          'No more squinting at the top of the range mid-run.',
        ].join('\n'),
      },
      {
        id: 'best-scores-bar',
        icon: 'trophy',
        accent: '#c36282',
        title: 'Best scores, up top',
        body: [
          "A thin line above the game now shows your best on this board next to today's, this week's and the all-time high.",
          '',
          'It stays out of the way for the first few seconds of a run.',
        ].join('\n'),
      },
      {
        id: 'speed-retune',
        icon: 'timer',
        accent: '#E5534B',
        title: 'Speed eases off',
        body: [
          'Speed mode was brutal. Now it is merely fast — about half again as long on every target.',
        ].join('\n'),
      },
      {
        id: 'speed-streak',
        icon: 'flash',
        accent: '#c36282',
        title: 'Speed combos, rebuilt',
        body: [
          'Your Speed combo now grows on every quick hit instead of waiting for a clear board — but a slow one breaks it.',
          '',
          'Land a target with most of its ring still full and it pays extra.',
        ].join('\n'),
      },
    ],
  },
]
