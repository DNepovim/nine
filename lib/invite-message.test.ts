import { describe, expect, it } from 'vitest'

import { boardName, shouldBoast, titleCase } from './invite-message'

describe('shouldBoast', () => {
  it('names the best when there is one on a scored board', () => {
    expect(shouldBoast('accuracy', 4820)).toBe(true)
  })

  it('describes the game instead when the board has no best yet', () => {
    expect(shouldBoast('speed', 0)).toBe(false)
  })

  it('never brags on trainee, which keeps no board', () => {
    expect(shouldBoast('trainee', 9999)).toBe(false)
  })
})

describe('boardName', () => {
  it('drops the UI shout to something that reads in a chat thread', () => {
    expect(boardName('ACCURACY', 'HARD')).toBe('Accuracy, Hard')
  })

  it('works on whatever the active locale resolved to', () => {
    expect(boardName('PŘESNOST', 'TĚŽKÁ')).toBe('Přesnost, Těžká')
  })
})

describe('titleCase', () => {
  it('leaves an empty label alone', () => {
    expect(titleCase('')).toBe('')
  })
})
