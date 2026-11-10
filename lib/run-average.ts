// A run's average for one figure — accuracy or speed — as a whole percent: what the weights add up
// to over the hits taken, or nothing for a run with no hit yet.
export function averageOf(sum: number, hits: number): number {
  return hits > 0 ? Math.round((100 * sum) / hits) : 0
}

// Which way a figure went between two readings, for the arrow beside the average. Only asked of a
// figure that moved: one that held still reads as down, which no caller shows.
export const headingOf = (now: number, was: number): 1 | -1 => (now > was ? 1 : -1)
