// Workbox config for generating the PWA service worker after `expo export`.
// Precaches the exported web assets in `dist/` for offline support.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{js,html,css,ttf,otf,woff,woff2,ico,png,json,svg}',
    // Expo exports icon fonts and other assets as hash-named files without
    // extensions in assets/ — catch them all so the app works fully offline.
    'assets/**',
    // Anything Expo pulled out of a dependency keeps that dependency's path, and
    // under pnpm every one of those runs through the `.pnpm` store — glob hides a
    // dot-prefixed segment from `**`, so the two patterns above see none of them.
    // Naming the directory is what puts the vector-icon fonts in the precache;
    // without it the hearts render as empty squares the moment the app is offline.
    'assets/**/.pnpm/**',
  ],
  swDest: 'dist/sw.js',
  // The Expo web bundle is large; raise the limit so it gets precached for offline use.
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  // First install claims the page straight away, so the app is offline-capable from
  // the load that installed it rather than from the next one.
  clientsClaim: true,
  // A new worker waits instead of taking over the moment it installs, and the app
  // decides when to let it through — see hooks/use-app-update.web.ts.
  //
  // Two reasons. A running page keeps the bundle it booted with, so activating early
  // never updated the session it interrupted; it only meant the new worker started
  // answering that page's requests, and an asset it asked for later under an old hash
  // was in neither the new precache nor the new deployment. And the swap ends in a
  // reload, which mid-run would throw the run away.
  //
  // With this false, workbox's template adds a `message` listener that calls
  // skipWaiting() on `postMessage({type: 'SKIP_WAITING'})`. That message is the handle
  // the app uses; changing this back to true removes it.
  skipWaiting: false,
  navigateFallback: '/index.html',
  // Avoid precaching the service worker file itself.
  globIgnores: ['sw.js'],
}
