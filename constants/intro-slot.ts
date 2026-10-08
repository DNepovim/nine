// The card the intro's slot holds: Trainee's tips, and the teaser ARCADE shows a player who
// cannot open it yet. One shape for both, because they stand in the same place one pill
// apart — a box that changed width or height as the pills were tried would be the screen
// rearranging itself under a player who was only looking.
//
// The height is the measurement that is not free. A scored mode fills that slot with three
// things, each a fixed height of its own: the difficulty row (17), the winners line (15,
// under `mt-1`) and the board (138, under `mb-5`), with the panel's `gap-2` between them —
// 218px from the pills down to the first button. Both cards hang `mb-8` under themselves,
// and the same gap-2 sits above them, so the card itself is 218 − 32 − 8.
//
// That is why the board's own height is a constant too and not a minimum (see `BODY_HEIGHT`
// in tab-panel.tsx): the whole column is a stack of fixed boxes, and one of them sizing to
// its content is the rest of the screen moving whenever that content changes.
//
// Re-measure if any of those three change. The check is the one the player would make:
// press through TRAINEE, ACCURACY, SPEED and ARCADE and watch PLAY GAME — it must not move.
export const SLOT_CARD = {
  height: 178,
  // The tips card's own edge, shared so the teaser cannot drift from it. The what's-new
  // dialog's edge at half weight — see mode-tips.tsx for why a plain border rather than
  // that dialog's padded gradient.
  radius: 20,
  border: 1,
} as const
