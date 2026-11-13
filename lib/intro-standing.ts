// Where the player stands on the intro: which menu overlay is up, whether it replaces the
// screen it was opened from, and what that leaves the start screen free to show.

import { isOneOf } from 'narrowland'

import type { AnalyticsEvents } from '@/lib/analytics-events'

// The menu-level overlays, one open at a time. 'none' means the screen under them —
// the intro or the pause screen — is what shows. Feedback is not here: it is a
// dialog over whatever is showing, not a screen of its own.
export type MenuOverlayName =
  'none' | 'advanced' | 'howToPlay' | 'news' | 'joinRoom' | 'admin'

// Which of them are dialogs rather than screens. Options and the guide are cards over
// whatever asked for them, so the screen underneath has to stay drawn: a scrim over
// nothing is just a darker game grid, and a player who opened Options from the intro was
// being shown the board instead of the screen they had come from. The rest replace what
// opened them and take it down.
const MENU_DIALOGS = [
  'advanced',
  'howToPlay',
] as const satisfies readonly MenuOverlayName[]

// Whether this overlay replaces the screen it was opened from rather than covering it,
// and so whether that screen comes down for it.
export function isMenuScreen(overlay: MenuOverlayName): boolean {
  return overlay !== 'none' && !isOneOf(overlay, MENU_DIALOGS)
}

// Where the player stands on the start screen: whether it is drawn, and whether it is the
// only thing between them and the game.
//
// Two answers because a dialog leaves the intro drawn but not alone, and that is exactly
// the difference between painting it and interrupting it — the start screen is painted on
// `drawn`, and everything that would interrupt it waits on `alone`.
export function introStanding(
  // Everything about being at the intro except what is stacked over it.
  atIntro: boolean,
  menuOverlay: MenuOverlayName,
): { drawn: boolean; alone: boolean } {
  const drawn = atIntro && !isMenuScreen(menuOverlay)
  return { drawn, alone: drawn && menuOverlay === 'none' }
}

// The first launch's tutorial offer, and what it holds back.
//
// The offer goes ahead of every other launch ask: it is the one question a player with
// nothing on the device needs answered before any of the others mean anything. Every ask
// waits on `free`, so holding that while the offer is owed is what queues them behind it.
export function welcomeStanding(
  introAlone: boolean,
  splashDone: boolean,
  welcomePending: boolean,
): { offer: boolean; free: boolean } {
  return {
    offer: introAlone && splashDone && welcomePending,
    free: introAlone && !welcomePending,
  }
}

// Overlay names → the screen names the warehouse knows, so the event table stays the
// only place that spells them. 'none' has no row: it is a closing, not an opening.
export const OVERLAY_SCREENS = {
  advanced: 'options',
  howToPlay: 'how_to_play',
  news: 'news',
  joinRoom: 'join_room',
  admin: 'admin',
} as const satisfies Record<
  Exclude<MenuOverlayName, 'none'>,
  AnalyticsEvents['screen_opened']['screen']
>
