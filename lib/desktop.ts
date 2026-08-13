// A window bigger than any phone — where the app stops filling the screen and draws
// itself inside a phone frame instead.
//
// One definition, shared, because the things that depend on it have to agree: the
// frame, and the install popup that must not appear behind it. Both dimensions are
// checked, so a phone held sideways — wide, but nowhere near tall enough — is still
// a phone.
const DESKTOP_MIN_WIDTH = 700
const DESKTOP_MIN_HEIGHT = 520

export const isDesktopViewport = (width: number, height: number): boolean =>
  width >= DESKTOP_MIN_WIDTH && height >= DESKTOP_MIN_HEIGHT
