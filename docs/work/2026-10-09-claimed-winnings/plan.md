# Winnings you accept, and a podium that pays — Plan

Spec: docs/work/2026-10-09-claimed-winnings/spec.md

## Tasks

- [ ] 1. `supabase/migrations/20261009120000_winnings_accepted.sql` — `winnings_paid` with RLS and no policies; the backfill; `my_winnings` gaining `rank` and `p_podium_from` (drop the 3-arg form, revoke its grants); `my_unpaid_winnings`; `accept_winnings`; `player_profile` summing to `paid_through` and grouping by period × rank
- [ ] 2. `lib/winnings.ts` — `WinRank`, `PODIUM_SHARE`, `winFactor(period, difficulty, rank)`, `rank` on `Award`, `BoardWinnings` as one row per board × period × rank; `lib/winnings.test.ts`
- [ ] 3. `lib/winnings-announcement.ts` — key a block by rank too, order gold → silver → bronze inside a day, replace `announcementRange`/`markerAfter` with the asked-today brake; `lib/winnings-announcement.test.ts`
- [ ] 4. `lib/player-profile.ts` — read `period`/`rank` off the wire, treat a row without `rank` as the old gold shape; `lib/player-profile.test.ts`
- [ ] 5. `lib/leaderboard.ts` — `fetchUnpaidWinnings`, `acceptWinnings`, `rank` on the row type
- [ ] 6. `constants/storage.ts` + `lib/local-reset.ts` + `hooks/use-winnings.ts` — `ASKED_WINNINGS_KEY`, and the hook asking, offering and accepting
- [ ] 7. `hooks/use-popup-deck.ts` — expose `accept`; `dismiss` stops settling winnings
- [ ] 8. `constants/buttons.ts` + `components/overlays/popup-card-view.tsx` + `components/overlays/whats-new-overlay.tsx` — `news.accept`, `popupPrimary(card)`, and the footer button taking its label and action from the page
- [ ] 9. `lib/winnings-lines.ts` — a lead pool per period per rank, `ALL_PHRASINGS`; `lib/winnings-lines.test.ts`
- [ ] 10. `components/overlays/winnings-card.tsx` — the footer saying the reward is waiting
- [ ] 11. `dev/gallery.tsx` — ranks on the award builder, a podium case
- [ ] 12. `pnpm i18n:extract` + Czech, and the `CLAUDE.md` rows for podium / paid through / accept

## Verification log

_(verify fills this in)_
