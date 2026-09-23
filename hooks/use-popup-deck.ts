import { useCallback, useMemo } from 'react'

import { useWhatsNew } from '@/hooks/use-whats-new'
import { useWinnings } from '@/hooks/use-winnings'
import type { PopupCard } from '@/types/popup'

// Everything the launch popup has to say, in the order it says it.
//
// Winnings lead: they are about the player rather than about the app, and unlike a
// release they expire — a day announced is a day gone. Releases follow, oldest first,
// which is the order `useWhatsNew` already hands them over in.
//
// `ready` waits on both, so whatever queues behind the popup — the install prompt — is not
// let through while one of the two is still deciding whether it has something to say.
export function usePopupDeck(userId: string | null) {
  const news = useWhatsNew()
  const winnings = useWinnings(userId)

  const cards = useMemo<PopupCard[]>(
    () => [
      ...(winnings.blocks.length > 0
        ? [{ kind: 'winnings' as const, blocks: winnings.blocks }]
        : []),
      ...news.unseen.map((item) => ({ kind: 'news' as const, item })),
    ],
    [winnings.blocks, news.unseen],
  )

  // Both, always. The dialog is dismissed as a whole, so a page left unread is still a
  // page that was shown — and a marker left behind would reopen the dialog next launch.
  const dismiss = useCallback(() => {
    winnings.dismiss()
    news.dismiss()
  }, [winnings.dismiss, news.dismiss])

  return {
    cards,
    visible: cards.length > 0,
    ready: news.ready && winnings.ready,
    dismiss,
  }
}
