import type { AnalyticsEvent, AnalyticsEvents } from '@/lib/analytics-events'

// The native half of analytics: nothing.
//
// The app ships as a web PWA — `.eas/workflows/deploy.yml` exports web and deploys it,
// and no CI job builds iOS or Android. Rather than carry `posthog-react-native` and its
// four `expo-*` peers for a platform nobody is running, native gets these no-ops and web
// gets the real thing in `analytics.web.ts`.
//
// Every call site talks to this signature, so the day native ships the only file that
// changes is this one.

export const initAnalytics = (): void => {
  // No native analytics yet.
}

export const identify = (_userId: string, _nickname: string | null): void => {
  // No native analytics yet.
}

export const track = <E extends AnalyticsEvent>(
  _event: E,
  _properties: AnalyticsEvents[E],
): void => {
  // No native analytics yet.
}

export const captureError = (
  _error: unknown,
  _context?: Record<string, unknown>,
): void => {
  // No native analytics yet.
}
