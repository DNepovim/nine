import type { SessionCard } from '@/lib/challenge-session'
import type { WeekFacts } from '@/lib/recap'
import type { OpenSession } from '@/lib/session-board'
import type { SessionSummary } from '@/lib/session-summary'
import type { AwardBlock } from '@/lib/winnings-announcement'
import type { NewsItem } from '@/types/news'

// One page of the launch popup.
//
// The dialog used to be a list of announcements and nothing else. It now carries things
// of different kinds — what you won while you were away, and what changed in the app —
// so that a morning with both is one dialog with two pages rather than two dialogs in a
// row. The weekly recap is the third, and the reason the arrangement was worth building:
// a Monday has all three to say at once.
//
// A recap carries facts rather than sentences. The card composes, so switching language
// retells the week instead of leaving whichever language the paragraph was built in — and
// `from` is the seed as well as the window, which is what makes a reopened dialog say the
// same thing. See lib/recap.ts.
export type PopupCard =
  // `accepted` is the page's own state rather than the deck's: a reward is turned into
  // fortune by pressing the dialog's button, and both the card's footer and that button
  // read this to know whether it has been.
  | { kind: 'winnings'; blocks: readonly AwardBlock[]; accepted: boolean }
  | { kind: 'recap'; facts: WeekFacts; from: string; to: string }
  // What one closed **session** came to, for a player who played it. At most one of these
  // is ever on a deck: a summary speaks for a contest that is over, and only the one that
  // just ended is still worth telling — see `summaryOwed`. `invite` is the next session the
  // start screen is allowed to name, or null, resolved by the hook rather than the card so
  // the page cannot announce a challenge ahead of its own teaser. It carries the card's
  // *face* as well as its session, because a teased one counts towards its open and a
  // live one towards its close.
  | { kind: 'summary'; summary: SessionSummary; invite: SessionCard<OpenSession> }
  | { kind: 'news'; item: NewsItem }
