import type { WeekFacts } from '@/lib/recap'
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
  | { kind: 'winnings'; blocks: readonly AwardBlock[] }
  | { kind: 'recap'; facts: WeekFacts; from: string; to: string }
  | { kind: 'news'; item: NewsItem }
