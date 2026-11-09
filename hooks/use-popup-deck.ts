import { useCallback, useMemo } from 'react'

import type { Flag } from '@/constants/features'
import { useSessionRating } from '@/hooks/use-session-rating'
import { useSessionSummaries } from '@/hooks/use-session-summaries'
import { useWeeklyRecap } from '@/hooks/use-weekly-recap'
import { useWhatsNew } from '@/hooks/use-whats-new'
import { useWinnings } from '@/hooks/use-winnings'
import type { PopupCard } from '@/types/popup'

// Everything the launch popup has to say, in the order it says it.
//
// Winnings lead: about the player rather than about the game, and unlike a release they
// expire — a day announced is a day gone. The recap is next, being the other thing that
// expires: it speaks for one week and is never offered again. Releases come last, oldest
// first, which is the order `useWhatsNew` already hands them over in and the only one of
// the three that will still be there tomorrow.
//
// The session **summary** is not a page of this deck any more: it opens the rating dialog,
// which `rating` below feeds. It is still read here, because the deck is where the launch's
// reads are gathered, and `ready` waits on it as on the rest, so whatever queues behind the popup — the install prompt — is
// not let through while any of them is still deciding whether it has something to say.
export function usePopupDeck(
  userId: string | null,
  runSessionId: string | null,
  // What this player reaches. Passed down rather than read here, because this hook is
  // called from the game screen's **body** and `FlagsProvider` is rendered in that same
  // component's **JSX** — a provider in a component's markup is not above that component's
  // own hooks, so `useFlag` at this depth answers false forever. Two pages were silent on
  // that account before anyone noticed; see the notes on the two hooks below.
  features: ReadonlySet<Flag>,
) {
  const news = useWhatsNew()
  const winnings = useWinnings(userId)
  const recap = useWeeklyRecap(features.has('recap'))
  const summaries = useSessionSummaries(userId, runSessionId, features.has('challenges'))
  // Not a page of the deck: the session's own dialog — summary, rating, remark, vote —
  // opened once this one has gone. Here rather than beside the deck because the summary
  // hook is what knows which session it is about.
  const rating = useSessionRating(summaries.summary, summaries.dismiss)

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
    ready: news.ready && winnings.ready && recap.ready && summaries.ready,
    dismiss,
    accept: winnings.accept,
    rating,
  }
}
