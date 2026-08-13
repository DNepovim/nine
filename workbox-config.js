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
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: '/index.html',
  // Avoid precaching the service worker file itself.
  globIgnores: ['sw.js'],
}
