import { useCallback, useMemo } from 'react'

import { useWeeklyRecap } from '@/hooks/use-weekly-recap'
import { useWhatsNew } from '@/hooks/use-whats-new'
import { useWinnings } from '@/hooks/use-winnings'
import type { PopupCard } from '@/types/popup'

// Everything the launch popup has to say, in the order it says it.
//
// Winnings lead: they are about the player rather than about the game, and unlike a release
// they expire — a day announced is a day gone. The recap follows, being the other thing that
// expires: it speaks for one week and is never offered again. Releases come last, oldest
// first, which is the order `useWhatsNew` already hands them over in and the only one of the
// three that will still be there tomorrow.
//
// `ready` waits on all three, so whatever queues behind the popup — the install prompt — is
// not let through while any of them is still deciding whether it has something to say.
export function usePopupDeck(userId: string | null) {
  const news = useWhatsNew()
  const winnings = useWinnings(userId)
  const recap = useWeeklyRecap()

  const cards = useMemo<PopupCard[]>(
    () => [
      ...(winnings.blocks.length > 0
        ? [
            {
              kind: 'winnings' as const,
              blocks: winnings.blocks,
              accepted: winnings.accepted,
            },
          ]
        : []),
      ...(recap.facts !== null
        ? [{ kind: 'recap' as const, facts: recap.facts, from: recap.from, to: recap.to }]
        : []),
      ...news.unseen.map((item) => ({ kind: 'news' as const, item })),
    ],
    [winnings.blocks, winnings.accepted, recap.facts, recap.from, recap.to, news.unseen],
  )

  // All three, always. The dialog is dismissed as a whole, so a page left unread is still a
  // page that was shown — and a marker left behind would reopen the dialog next launch.
  //
  // Every one of these empties the state the deck builds its cards from, which is what
  // takes `visible` false and so unmounts the dialog. A hook left out here does not simply
  // keep its page: it keeps the whole dialog mounted and invisible over the intro.
  //
  // What changed for winnings is *which* of the two things their dismiss did. It used to
  // move their marker as well, because being shown a reward was the same thing as having
  // it; settling one because somebody closed a dialog would now be the whole change
  // inverted. So `useWinnings.dismiss` clears its pages and touches no watermark — the only
  // thing that settles winnings is `accept`, and a player who closes without pressing is
  // offered the same reward next launch.
  const dismiss = useCallback(() => {
    winnings.dismiss()
    recap.dismiss()
    news.dismiss()
  }, [winnings.dismiss, recap.dismiss, news.dismiss])

  return {
    cards,
    visible: cards.length > 0,
    ready: news.ready && winnings.ready && recap.ready,
    dismiss,
    accept: winnings.accept,
  }
}
