import { afterEach, describe, expect, it, vi } from 'vitest'

// A fresh module per case: the URL is worked out once, at import, from the env.
const load = async (env: Record<string, string | undefined>) => {
  vi.resetModules()
  vi.doMock('@/lib/env', () => ({ env }))
  return import('./posthog-project')
}

afterEach(() => {
  vi.doUnmock('@/lib/env')
})

describe('POSTHOG_PROJECT_URL', () => {
  it('opens the Nine project on the EU app by default', async () => {
    const { POSTHOG_PROJECT_URL } = await load({})
    expect(POSTHOG_PROJECT_URL).toBe('https://eu.posthog.com/project/251472')
  })

  it('follows the ingestion host to its region', async () => {
    const { POSTHOG_PROJECT_URL } = await load({
      EXPO_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
      EXPO_PUBLIC_POSTHOG_PROJECT_ID: '42',
    })
    expect(POSTHOG_PROJECT_URL).toBe('https://us.posthog.com/project/42')
  })

  it('falls back to EU behind a proxy, which says nothing about the region', async () => {
    const { POSTHOG_PROJECT_URL } = await load({
      EXPO_PUBLIC_POSTHOG_HOST: 'https://t.nine.example',
    })
    expect(POSTHOG_PROJECT_URL).toBe('https://eu.posthog.com/project/251472')
  })
})
