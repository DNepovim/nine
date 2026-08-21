import { beforeEach, describe, expect, it, vi } from 'vitest'

// The web variant is the one with behaviour worth testing, and it is imported by path:
// bare `./update-reload` resolves to the native no-op outside Metro.
const load = async () => {
  // A fresh module per case. The answer is memoised for the life of a page load, and a
  // new import is exactly what a new page load gives us.
  vi.resetModules()
  return import('./update-reload.web')
}

const store = new Map<string, string>()

// Enough of sessionStorage to exercise the module — the test environment is node, so
// there is none.
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
  vi.stubGlobal('sessionStorage', working)
})

describe('update reload note', () => {
  it('says no on a cold start, with nothing left behind', async () => {
    const { consumeUpdateReload } = await load()
    expect(consumeUpdateReload()).toBe(false)
  })

  it('says yes on the load that follows a marked reload', async () => {
    const first = await load()
    first.markUpdateReload()

    const next = await load()
    expect(next.consumeUpdateReload()).toBe(true)
  })

  it('clears the note, so the load after that is a cold start again', async () => {
    const first = await load()
    first.markUpdateReload()

    const next = await load()
    next.consumeUpdateReload()

    const third = await load()
    expect(third.consumeUpdateReload()).toBe(false)
  })

  it('gives the same answer to every caller in one load', async () => {
    const first = await load()
    first.markUpdateReload()

    const { consumeUpdateReload } = await load()
    // React can call a lazy state initialiser twice; the second must not read a note
    // the first already cleared and put the splash back.
    expect([consumeUpdateReload(), consumeUpdateReload()]).toEqual([true, true])
  })

  it('treats unavailable storage as a cold start rather than throwing', async () => {
    vi.stubGlobal('sessionStorage', throwing)
    const { consumeUpdateReload } = await load()
    expect(consumeUpdateReload()).toBe(false)
  })

  it('does not throw when the note cannot be written', async () => {
    vi.stubGlobal('sessionStorage', throwing)
    const { markUpdateReload } = await load()
    expect(() => {
      markUpdateReload()
    }).not.toThrow()
  })
})
