// A nickname cut to the room a surface has for it.
//
// By characters rather than by a pixel width, because every surface that needs this
// draws names in the monospace face: a character count *is* a width there, and it is one
// the app can reason about rather than hand to the platform. `numberOfLines` would be
// the usual answer, but a gradient name is one `Text` per character — a nested run that
// React Native truncates without an ellipsis on Android, or not at all. Cutting the
// string is the one way to be sure the reader can see that something was cut.
//
// Steps code points, so a name carrying an emoji or a combining mark loses whole
// characters rather than half of a surrogate pair.
//
// The ellipsis takes one of the places, so the result is never wider than asked for.
export function shortName(nickname: string, max: number): string {
  const letters = Array.from(nickname)
  if (letters.length <= max) return nickname
  return `${letters.slice(0, max - 1).join('')}…`
}
