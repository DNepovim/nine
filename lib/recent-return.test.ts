import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The web variant is the one with behaviour worth testing, and it is imported by path:
// bare `./recent-return` resolves to the native no-op outside Metro. Same arrangement as
// update-reload.test.ts, for the same reason.
const load = async () => {
  // A fresh module per case. The answer is held for the life of a page load, and a new
  // import is exactly what a new page load gives us.
  vi.resetModules()
  return import('./recent-return.web')
}

const store = new Map<string, string>()

const working = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
}

// Safari in private browsing throws on access rather than returning null.
const throwing = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('denied')
  },
  removeItem: () => {
    throw new Error('denied')
  },
}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', working)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the came-straight-back note', () => {
  it('says no on a cold start, with nothing left behind', async () => {
    const { cameStraightBack } = await load()
    expect(cameStraightBack()).toBe(false)
  })

  // The case the whole thing exists for: away to a mail app, killed while away, back.
  it('says yes when the app was left moments ago', async () => {
    const first = await load()
    first.noteLeaving()
    vi.advanceTimersByTime(20_000)

    const next = await load()
    expect(next.cameStraightBack()).toBe(true)
  })

  // The launch the logo is actually for. A note with no clock on it would skip the splash
  // here, which is the one place it must not.
  it('says no once the note is older than the window', async () => {
    const first = await load()
    first.noteLeaving()
    vi.advanceTimersByTime(5 * 60_000)

    const next = await load()
    expect(next.cameStraightBack()).toBe(false)
  })

  // Not consumed on reading, unlike its neighbour: an afternoon of leaving and coming back
  // is several returns off one departure each, and every one of them is a return.
  it('keeps answering yes for a second return inside the window', async () => {
    const first = await load()
    first.noteLeaving()

    const second = await load()
    expect(second.cameStraightBack()).toBe(true)
    const third = await load()
    expect(third.cameStraightBack()).toBe(true)
  })

  // React may call a lazy state initialiser twice, and the clock moves between the two.
  it('answers the same twice in one page load', async () => {
    const first = await load()
    first.noteLeaving()

    const next = await load()
    expect([next.cameStraightBack(), next.cameStraightBack()]).toEqual([true, true])
  })

  // A clock that went backwards — a device whose time was corrected while the app was
  // away. Nothing is claimed about a note from the future.
  it('says no when the note is dated after now', async () => {
    const first = await load()
    first.noteLeaving()
    vi.setSystemTime(Date.now() - 60_000)

    const next = await load()
    expect(next.cameStraightBack()).toBe(false)
  })

  it('says no, rather than throwing, when storage is unavailable', async () => {
    vi.stubGlobal('localStorage', throwing)
    const { cameStraightBack, noteLeaving } = await load()
    expect(() => {
      noteLeaving()
    }).not.toThrow()
    expect(cameStraightBack()).toBe(false)
  })
})
