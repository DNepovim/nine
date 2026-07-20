// Workbox config for generating the PWA service worker after `expo export`.
// Precaches the exported web assets in `dist/` for offline support.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,html,css,ttf,otf,woff,woff2,ico,png,json,svg}'],
  swDest: 'dist/sw.js',
  // The Expo web bundle is large; raise the limit so it gets precached for offline use.
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: '/index.html',
  // Avoid precaching the service worker file itself.
  globIgnores: ['sw.js'],
}
