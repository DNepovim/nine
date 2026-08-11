import { describe, expect, it } from 'vitest'

import type { InstallEnv } from '@/types/install'

import { resolveInstallTarget } from './install-target'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

// iPadOS Safari reports itself as a Mac — there is no 'iPad' in this string.
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1'

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const ANDROID_FIREFOX =
  'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0'

const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

const env = (overrides: Partial<InstallEnv>): InstallEnv => ({
  standalone: false,
  hasPrompt: false,
  uaMobile: undefined,
  userAgent: ANDROID_CHROME,
  maxTouchPoints: 0,
  ...overrides,
})

describe('resolveInstallTarget', () => {
  it('stays quiet when the app is already installed', () => {
    expect(resolveInstallTarget(env({ standalone: true, hasPrompt: true }))).toBe('none')
  })

  it('stays quiet in an installed iOS web app', () => {
    expect(
      resolveInstallTarget(
        env({ standalone: true, userAgent: IPHONE_SAFARI, maxTouchPoints: 5 }),
      ),
    ).toBe('none')
  })

  it('offers the install button on an Android browser that gave us the event', () => {
    expect(resolveInstallTarget(env({ hasPrompt: true, uaMobile: true }))).toBe('prompt')
  })

  it('stays quiet on Android until the install event arrives', () => {
    expect(resolveInstallTarget(env({ uaMobile: true }))).toBe('none')
  })

  it('stays quiet on desktop Chromium even though it can install', () => {
    expect(
      resolveInstallTarget(
        env({ hasPrompt: true, uaMobile: false, userAgent: DESKTOP_CHROME }),
      ),
    ).toBe('none')
  })

  it('shows the steps on iPhone Safari', () => {
    expect(
      resolveInstallTarget(env({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })),
    ).toBe('instructions')
  })

  it('shows the steps on iPadOS, which claims to be a Mac', () => {
    expect(resolveInstallTarget(env({ userAgent: IPAD_SAFARI, maxTouchPoints: 5 }))).toBe(
      'instructions',
    )
  })

  it('stays quiet in Chrome on iOS, whose toolbar is somewhere else', () => {
    expect(
      resolveInstallTarget(env({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 })),
    ).toBe('none')
  })

  it('stays quiet on a touchless Mac, which is not an iPad', () => {
    expect(resolveInstallTarget(env({ userAgent: MAC_SAFARI }))).toBe('none')
  })

  it('stays quiet in a browser that offers neither route', () => {
    expect(resolveInstallTarget(env({ userAgent: ANDROID_FIREFOX }))).toBe('none')
  })
})
