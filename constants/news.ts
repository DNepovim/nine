import type { Release } from '@/types/news'

// Everything ever announced, newest release first. Adding an entry here is the
// whole act of announcing something — the popup and the archive both read it.
//
// Item ids are permanent: reword a title freely, but never reuse an id for a
// different announcement or players who already saw the old one will miss it.
export const RELEASES: Release[] = [
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
    ],
  },
]
