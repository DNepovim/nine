// Who took a board in a window that has already closed — yesterday, and the week
// before this one. Neither can change again, which is what separates this from a
// record or a medal: it is a result, not a standing anyone can still take back.

// A board's winner for one closed window. The id is what the both-won check turns on,
// and what a champion mark is looked up by.
export type Winner = { userId: string; nickname: string }

// Which sentence a line is. `both` is not a third window — it is the two collapsing
// into one, because "ADA took yesterday" followed by "ADA took last week" reads as a
// fade that went nowhere.
export type WinnerWindow = 'yesterday' | 'lastWeek' | 'both'

export type WinnerLine = { window: WinnerWindow; winner: Winner }

// What the stripe cycles through: two lines, one, or none at all.
//
// Yesterday leads when both are shown — it is the more recent result, and the one a
// player is likelier to have seen happen.
export function winnerLines({
  yesterday,
  lastWeek,
}: {
  yesterday: Winner | null
  lastWeek: Winner | null
}): WinnerLine[] {
  if (yesterday === null) {
    return lastWeek === null ? [] : [{ window: 'lastWeek', winner: lastWeek }]
  }
  if (lastWeek === null) return [{ window: 'yesterday', winner: yesterday }]
  // Matched on id rather than nickname: a player who renamed between the two windows
  // is still one player, and the board would otherwise congratulate them twice under
  // two names. The newer of the two names is the one they answer to now.
  if (yesterday.userId === lastWeek.userId) return [{ window: 'both', winner: yesterday }]
  return [
    { window: 'yesterday', winner: yesterday },
    { window: 'lastWeek', winner: lastWeek },
  ]
}
