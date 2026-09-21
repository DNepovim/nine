import { afterEach, describe, expect, it, vi } from 'vitest'

import { newRunId } from './run-id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newRunId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the platform generator when there is one', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    vi.stubGlobal('crypto', { randomUUID })
    expect(newRunId()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('falls back to a v4-shaped id where the platform has none', () => {
    vi.stubGlobal('crypto', undefined)
    expect(newRunId()).toMatch(UUID_V4)
  })

  it('does not repeat itself', () => {
    vi.stubGlobal('crypto', undefined)
    const ids = new Set(Array.from({ length: 500 }, newRunId))
    expect(ids.size).toBe(500)
  })
})
