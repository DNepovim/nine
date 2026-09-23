import { NewsCard } from '@/components/overlays/news-card'
import { WinningsCard } from '@/components/overlays/winnings-card'
import { APP_VIOLET } from '@/constants/colors'
import type { PopupCard } from '@/types/popup'

// One page of the launch popup, whichever kind it is.
//
// The dialog around it decides how much room a page gets and draws the dots and the way
// out; this is only the choice of what goes on the page.
export function PopupCardView({ card }: { card: PopupCard }) {
  if (card.kind === 'winnings') return <WinningsCard blocks={card.blocks} />
  return <NewsCard item={card.item} />
}

// What the dots and the BACK arrow tint to on this page. An announcement carries its own
// accent; winnings take the app's violet, for the reason the card itself explains.
export const popupAccent = (card: PopupCard): string =>
  card.kind === 'winnings' ? APP_VIOLET : card.item.accent
