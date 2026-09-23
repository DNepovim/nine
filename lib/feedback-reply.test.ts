import { describe, expect, it } from 'vitest'

import { toReplies } from './feedback-reply'

describe('toReplies', () => {
  it('keeps every answered row, in the order the server gave them', () => {
    expect(
      toReplies([
        { id: 'a', answer: 'Fixed in this build.' },
        { id: 'b', answer: 'Not planned, sorry.' },
      ]),
    ).toEqual([
      { id: 'a', answer: 'Fixed in this build.' },
      { id: 'b', answer: 'Not planned, sorry.' },
    ])
  })

  it('trims the answer', () => {
    expect(toReplies([{ id: 'a', answer: '  Fixed.\n' }])).toEqual([
      { id: 'a', answer: 'Fixed.' },
    ])
  })

  it('drops a row whose answer is only whitespace', () => {
    expect(toReplies([{ id: 'a', answer: '   ' }])).toEqual([])
  })

  it('drops a row with no usable id', () => {
    expect(toReplies([{ id: '', answer: 'Fixed.' }, { answer: 'Fixed.' }])).toEqual([])
  })

  it('drops a row that is not an object', () => {
    expect(toReplies(['Fixed.', null, 7])).toEqual([])
  })

  it('answers with nothing when the request did', () => {
    expect(toReplies(null)).toEqual([])
    expect(toReplies(undefined)).toEqual([])
  })

  it('answers with nothing when the response is not a list at all', () => {
    expect(toReplies({ id: 'a', answer: 'Fixed.' })).toEqual([])
  })
})
