import { describe, expect, it } from 'vitest'

import { parsePushConsent, pushStepDue } from '@/lib/push-consent'

const due = (over: Partial<Parameters<typeof pushStepDue>[0]>) =>
  pushStepDue({
    held: true,
    reach: 'ready',
    replay: 'granted',
    push: 'unknown',
    dismissed: false,
    ...over,
  })

describe('parsePushConsent', () => {
  it('reads the two answers and calls anything else unknown', () => {
    expect(parsePushConsent('granted')).toBe('granted')
    expect(parsePushConsent('denied')).toBe('denied')
    expect(parsePushConsent(null)).toBe('unknown')
    expect(parsePushConsent('yes')).toBe('unknown')
  })
})

describe('pushStepDue', () => {
  it('is due for an existing player once the feature is held', () => {
    expect(due({})).toBe(true)
    expect(due({ replay: 'denied' })).toBe(true)
  })

  it('waits behind the replay ask on a fresh install', () => {
    expect(due({ replay: 'unknown' })).toBe(false)
  })

  it('is not due without the feature', () => {
    expect(due({ held: false })).toBe(false)
  })

  it('is not due where nothing can be subscribed', () => {
    expect(due({ reach: 'unsupported' })).toBe(false)
  })

  it('still asks on an iOS tab and a blocked browser, which have their own wording', () => {
    expect(due({ reach: 'install' })).toBe(true)
    expect(due({ reach: 'blocked' })).toBe(true)
  })

  it('is not due once answered, or once waved off this session', () => {
    expect(due({ push: 'granted' })).toBe(false)
    expect(due({ push: 'denied' })).toBe(false)
    expect(due({ dismissed: true })).toBe(false)
  })
})
