// The splash, hidden before the page has painted, on the two web launches that skip it.
//
// The web build is rendered to static HTML, and that HTML is rendered with no storage to
// read — so it always holds the splash, drawn full-screen at full opacity. The app skips
// it on an update reload and on a quick return (see `SplashProvider`), but only once the
// bundle has loaded and hydrated: until then the browser paints what the file says, and
// the player who was looking at the intro a second ago sees the logo flash over it.
//
// So the page asks first. This script runs in the head, before the body is painted, and
// reads the same two notes the app reads — without clearing either, since clearing is
// the app's to do. If either says skip, a class on the root hides the splash; the app
// takes the class off once it has mounted, by which point it has made the same decision
// and either drawn no splash or drawn one it meant.
//
// The names the two halves share live here, with nothing imported, so the splash can
// carry its half into the native bundle; the script itself is lib/splash-skip-script.ts.
export const SKIP_SPLASH_CLASS = 'nine-skip-splash'

// The selector the class hides. `testID` because it is what React Native Web renders as
// an attribute of our choosing — Reanimated overwrites `id` on an animated view.
export const SPLASH_TEST_ID = 'splash'
