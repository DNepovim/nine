import { describe, expect, it } from 'vitest'

import { pushHelp, pushReach, type PushEnv } from '@/lib/push-reach'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15'
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120'

const env = (over: Partial<PushEnv>): PushEnv => ({
  configured: true,
  userAgent: DESKTOP,
  maxTouchPoints: 0,
  standalone: false,
  hasPushApi: true,
  permission: 'default',
  ...over,
})

describe('pushReach', () => {
  it('is ready where the API is there and nothing has been refused', () => {
    expect(pushReach(env({}))).toBe('ready')
    expect(pushReach(env({ permission: 'granted' }))).toBe('ready')
  })

  it('asks iOS to install first, even though a tab there has no Push API', () => {
    expect(pushReach(env({ userAgent: IPHONE, hasPushApi: false }))).toBe('install')
    expect(pushReach(env({ userAgent: IPHONE }))).toBe('install')
  })

  it('sees through iPadOS posing as a Mac', () => {
    const ipad = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      maxTouchPoints: 5,
    }
    expect(pushReach(env({ ...ipad, hasPushApi: false }))).toBe('install')
  })

  it('is ready on an installed iOS app', () => {
    expect(pushReach(env({ userAgent: IPHONE, standalone: true }))).toBe('ready')
  })

  it('is unsupported without the Push API', () => {
    expect(pushReach(env({ hasPushApi: false }))).toBe('unsupported')
    expect(
      pushReach(env({ userAgent: IPHONE, standalone: true, hasPushApi: false })),
    ).toBe('unsupported')
  })

  it('is unsupported without the key, even on an iPhone tab', () => {
    expect(pushReach(env({ configured: false }))).toBe('unsupported')
    expect(pushReach(env({ configured: false, userAgent: IPHONE }))).toBe('unsupported')
  })

  it('is blocked once the browser has refused', () => {
    expect(pushReach(env({ permission: 'denied' }))).toBe('blocked')
  })
})

describe('pushHelp', () => {
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile'

  it('points an installed iPhone app at the phone settings', () => {
    expect(pushHelp({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true })).toBe(
      'ios-app',
    )
  })

  it('points an installed Android app at the app settings', () => {
    expect(pushHelp({ userAgent: ANDROID, maxTouchPoints: 5, standalone: true })).toBe(
      'android-app',
    )
  })

  it('points everything in a browser tab at the site settings', () => {
    expect(pushHelp({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe(
      'browser',
    )
    expect(pushHelp({ userAgent: DESKTOP, maxTouchPoints: 0, standalone: false })).toBe(
      'browser',
    )
  })

  it('treats an installed desktop app as a browser', () => {
    expect(pushHelp({ userAgent: DESKTOP, maxTouchPoints: 0, standalone: true })).toBe(
      'browser',
    )
  })
})
