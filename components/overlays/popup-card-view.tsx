import { NewsCard } from '@/components/overlays/news-card'
import { RecapCard } from '@/components/overlays/recap-card'
import { WinningsCard } from '@/components/overlays/winnings-card'
import { APP_VIOLET } from '@/constants/colors'
import type { PopupCard } from '@/types/popup'

// One page of the launch popup, whichever kind it is.
//
// The dialog around it decides how much room a page gets and draws the dots and the way
// out; this is only the choice of what goes on the page.
export function PopupCardView({ card }: { card: PopupCard }) {
  if (card.kind === 'winnings') return <WinningsCard blocks={card.blocks} />
  if (card.kind === 'recap') {
    return <RecapCard facts={card.facts} from={card.from} to={card.to} />
  }
  return <NewsCard item={card.item} />
}

// What the dots and the BACK arrow tint to on this page. An announcement carries its own
// accent; winnings and the recap both take the app's violet, for the reason their cards
// explain — each speaks for the game as a whole rather than for one mode.
export const popupAccent = (card: PopupCard): string =>
  card.kind === 'news' ? card.item.accent : APP_VIOLET
