import type { AwardBlock } from '@/lib/winnings-announcement'
import type { NewsItem } from '@/types/news'

// One page of the launch popup.
//
// The dialog used to be a list of announcements and nothing else. It now carries things
// of different kinds — what you won while you were away, and what changed in the app —
// so that a morning with both is one dialog with two pages rather than two dialogs in a
// row. The weekly recap (dev/weekly-recap/) becomes a third variant when it ships.
export type PopupCard =
  { kind: 'winnings'; blocks: readonly AwardBlock[] } | { kind: 'news'; item: NewsItem }
