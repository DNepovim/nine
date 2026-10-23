import { env } from '@/lib/env'

// Where this app's PostHog lives: the host events are sent to, and the project they land
// in, read from the same two settings so the analytics and the link to them cannot point
// at different places.

// EU by default. The region is fixed when the PostHog project is created and cannot be
// moved later without a migration, so the default here is the one that keeps EU players'
// events in the EU.
export const POSTHOG_HOST = env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

// The Nine project, which is the one the default key reports to. A build pointed at
// another project names it with EXPO_PUBLIC_POSTHOG_PROJECT_ID.
const PROJECT_ID = env.EXPO_PUBLIC_POSTHOG_PROJECT_ID ?? '251472'

// The app lives beside the host that takes the events: `eu.i.posthog.com` is ingestion,
// `eu.posthog.com` the screens. A host that is not PostHog's own — a reverse proxy — says
// nothing about where the app is, and falls back to the region the default sends to.
const appOrigin = (host: string): string => {
  const { hostname } = new URL(host)
  const region = /^([a-z]+)\.i\.posthog\.com$/.exec(hostname)?.[1]
  return `https://${region ?? 'eu'}.posthog.com`
}

// The project's home in PostHog, for the analytics screen's way out to it.
export const POSTHOG_PROJECT_URL = `${appOrigin(POSTHOG_HOST)}/project/${PROJECT_ID}`
