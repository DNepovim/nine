// What the challenges have settled about this player, as four counts — what PLACED,
// HEADLINER, HAT TRICK, PHOTO FINISH and FIRST FOOTPRINTS are asked of.
//
// From the server rather than from the **summary**, which tells only the newest close:
// a place taken in a session that shut while the app was closed would otherwise never
// count. See `…_session_places.sql` for what each count means; the read itself is
// `lib/my-session-places.ts`, kept apart so the rules can import this without the client.
export type SessionPlaces = {
  podiums: number
  wins: number
  photoFinishes: number
  firsts: number
}

// Nothing known. Also what the rules see until the read lands, which costs nothing: none
// of these can be lost, so a zero only ever means "not yet".
export const NO_PLACES: SessionPlaces = {
  podiums: 0,
  wins: 0,
  photoFinishes: 0,
  firsts: 0,
}
