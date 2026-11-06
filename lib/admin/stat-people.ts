import type { StatsPerson } from '@/lib/admin/stats'

// The six tiles at the top of the analytics screen, by what each one counts.
export type StatTileKey = 'joined' | 'played' | 'runs' | 'minutes' | 'hits' | 'named'

// What the list under one tile is made of, and the figure each row carries: the
// population the tile counts, and the per-player share of its number. `dates` are the days
// shown beside it: JOINED the day they joined, NAMED that and the day they named themselves,
// and the run tiles the last day they played in the window. JOINED and NAMED
// count profiles rather than an amount, so their rows carry runs — whether the people who
// arrived went on to play is the next thing anybody looking at them asks.
const TILES: Record<
  StatTileKey,
  {
    includes: (p: StatsPerson) => boolean
    figure: (p: StatsPerson) => number
    dates: (p: StatsPerson) => (string | null)[]
  }
> = {
  joined: {
    includes: (p) => p.joined,
    figure: (p) => p.runs,
    dates: (p) => [p.joinedOn],
  },
  named: {
    includes: (p) => p.joined && p.nickname !== null,
    figure: (p) => p.runs,
    dates: (p) => [p.joinedOn, p.namedOn],
  },
  played: {
    includes: (p) => p.runs > 0,
    figure: (p) => p.runs,
    dates: (p) => [p.lastPlayedOn],
  },
  runs: {
    includes: (p) => p.runs > 0,
    figure: (p) => p.runs,
    dates: (p) => [p.lastPlayedOn],
  },
  minutes: {
    includes: (p) => p.runs > 0,
    figure: (p) => p.elapsedMs / 60_000,
    dates: (p) => [p.lastPlayedOn],
  },
  hits: {
    includes: (p) => p.runs > 0,
    figure: (p) => p.hits,
    dates: (p) => [p.lastPlayedOn],
  },
}

export type StatLine = {
  // Null for the one line that stands for every profile without a nickname.
  userId: string | null
  nickname: string | null
  // How many profiles the line is. One, except on the unnamed line.
  count: number
  figure: number
  // The days the tile shows beside the name, as bare ISO days; null where unknown. Empty
  // on the unnamed line, which is many profiles and so has no day of its own.
  dates: (string | null)[]
}

// One tile's list, biggest figure first.
//
// Every profile without a nickname is folded into a single line at the bottom. On JOINED
// they are most of the list — an anonymous profile is made the first time anybody opens
// the app — and forty rows reading "(no nickname)" would push the people somebody tapped
// the tile to find off the card.
export function linesFor(tile: StatTileKey, people: readonly StatsPerson[]): StatLine[] {
  const { includes, figure, dates } = TILES[tile]
  const counted = people.filter(includes)
  const named = counted
    .flatMap((p) =>
      p.nickname === null
        ? []
        : [
            {
              userId: p.userId,
              nickname: p.nickname,
              count: 1,
              figure: figure(p),
              dates: dates(p),
            },
          ],
    )
    .sort((a, b) => b.figure - a.figure || a.nickname.localeCompare(b.nickname))
  const unnamed = counted.filter((p) => p.nickname === null)
  if (unnamed.length === 0) return named
  return [
    ...named,
    {
      userId: null,
      nickname: null,
      count: unnamed.length,
      figure: unnamed.reduce((sum, p) => sum + figure(p), 0),
      dates: [],
    },
  ]
}
