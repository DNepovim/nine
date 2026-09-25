import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

import { SURFACE } from '@/constants/colors'

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* PWA manifest and theming. */}
        <link rel="manifest" href="/manifest.json" />
        {/* The colour the phone paints its own chrome in: Safari's top bar, and the
            status bar above an installed app. The app's surface, so that chrome reads
            as part of the screen rather than a band above it — and the light one,
            because the app always boots light whatever the phone is set to. It does
            not stay light: AppThemeProvider rewrites this tag on every theme toggle,
            which is why the value is here and not a `prefers-color-scheme` pair. */}
        <meta name="theme-color" content={SURFACE.light} />

        {/* iOS standalone / add-to-home-screen support. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Deliberately not `black-translucent`: that would put the game under the
            status bar, and pin its text to white — unreadable on the parchment
            surface. Opaque lets iOS pick the ink to suit the colour above. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="nine" />
        <link rel="apple-touch-icon" href="/pwa-192.png" />

        {/* Catch the install event before React mounts. Chromium can fire it
            during the initial load, it is the only handle on the install dialog
            we ever get, and it does not fire twice. Not gated on NODE_ENV:
            there is nothing here to break in dev. */}
        <script dangerouslySetInnerHTML={{ __html: installCapture }} />

        {/* Register the Workbox service worker — only in production builds,
            where `expo export` actually generates /sw.js (it doesn't exist
            under `expo start`, which would otherwise 404 on registration). */}
        {process.env.NODE_ENV === 'production' && (
          <script dangerouslySetInnerHTML={{ __html: sw }} />
        )}

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}

// Stashed on window and announced, because hooks/use-install-prompt.web.ts may
// mount either before or after this fires.
const installCapture = `
window.addEventListener('beforeinstallprompt', (event) => {
  // Suppress Chrome's own install banner — the in-app popup replaces it.
  event.preventDefault();
  window.__nineInstallPrompt = event;
  window.dispatchEvent(new Event('nine:installable'));
});
`

const sw = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
  });
}
`
