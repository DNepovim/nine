import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import { NewsCard } from '@/components/overlays/news-card'
import { RecapCard } from '@/components/overlays/recap-card'
import { WinningsCard } from '@/components/overlays/winnings-card'
import type { ButtonId } from '@/constants/buttons'
import { APP_VIOLET } from '@/constants/colors'
import type { PopupCard } from '@/types/popup'

// One page of the launch popup, whichever kind it is.
//
// The dialog around it decides how much room a page gets and draws the dots and the way
// out; this is only the choice of what goes on the page.
export function PopupCardView({ card }: { card: PopupCard }) {
  if (card.kind === 'winnings') {
    return <WinningsCard blocks={card.blocks} accepted={card.accepted} />
  }
  if (card.kind === 'recap') {
    return <RecapCard facts={card.facts} from={card.from} to={card.to} />
  }
  return <NewsCard item={card.item} />
}

// What the dialog is called while it is on this page.
//
// Per page rather than per dialog, because the deck's pages are no longer all about the
// same thing: a release note is news about the game, and a reward is news about the player.
// One heading over both had to be vague enough to cover them, and "what's new in the game"
// is the wrong question to put over a player's own winnings.
//
// It asks rather than announces, which is also what lets the card beneath it drop its own
// title: the heading poses the question and the sentences answer it.
//
// Deliberately not "what you did *yesterday*", though that is the common case. The page
// carries every window the player has not accepted, so somebody back after a week away is
// reading four or five days — and a heading naming one of them would be wrong for exactly
// the player who has the most to read.
export const popupTitle = (card: PopupCard): ReactNode =>
  card.kind === 'winnings' ? (
    <Trans>WHAT DID YOU PULL OFF?</Trans>
  ) : (
    <Trans>WHAT’S NEW IN THE GAME?</Trans>
  )

// What the dots and the BACK arrow tint to on this page. An announcement carries its own
// accent; winnings and the recap both take the app's violet, for the reason their cards
// explain — each speaks for the game as a whole rather than for one mode.
export const popupAccent = (card: PopupCard): string =>
  card.kind === 'news' ? card.item.accent : APP_VIOLET

// What this page wants the dialog's own button to say, when it wants to own it. Null for
// every page that does not, which is all of them but one.
//
// The winnings page borrows the button rather than adding one. Two buttons on a page is
// two decisions where there is only one, and a reward sitting beside a NEXT that walked
// past it would be a reward nobody pressed for. Once settled it hands the button back, and
// the dialog goes on saying NEXT.
//
// It is the only thing on the page that *acts*, which is not the same as being the only way
// off it: the page dots jump to any page and the card's own header closes the dialog. Both
// leave the reward where it was, which is the behaviour the acceptance criteria ask for —
// paging past re-offers it, unpaid. Nothing here should be written as though the press were
// unavoidable, because it is not.
//
// The figure is not on the button. It is already on the card, set like a score and sized to
// be read — printing it twice on one page made the button restate the thing it was meant to
// act on, and the second copy is also the one that would have had to be kept in step.
//
// CLAIM, not ACCEPT, and that difference is only ever skin deep. In code this is `accept`
// throughout — `accept_winnings`, `useWinnings().accept` — because `claim` is already a
// medal standing in `toMedals` and may not mean two things. The player reads the word for
// what they are doing; the same arrangement as host/guest over `admin`.
export const popupPrimary = (
  card: PopupCard,
): { id: ButtonId; label: ReactNode } | null =>
  card.kind !== 'winnings' || card.accepted
    ? null
    : { id: 'news.accept', label: <Trans>CLAIM</Trans> }
