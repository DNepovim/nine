import { describe, expect, it } from 'vitest'

import { sentOnLabel, toReplies } from './feedback-reply'

const SENT = '2026-09-23T18:04:00Z'

describe('toReplies', () => {
  it('keeps every answered row, in the order the server gave them', () => {
    expect(
      toReplies([
        {
          id: 'a',
          answer: 'Fixed in this build.',
          message: 'It eats a press.',
          created_at: SENT,
        },
        {
          id: 'b',
          answer: 'Not planned, sorry.',
          message: 'Add a dark grid.',
          created_at: SENT,
        },
      ]),
    ).toEqual([
      {
        id: 'a',
        answer: 'Fixed in this build.',
        quote: { message: 'It eats a press.', sentAt: SENT },
      },
      {
        id: 'b',
        answer: 'Not planned, sorry.',
        quote: { message: 'Add a dark grid.', sentAt: SENT },
      },
    ])
  })

  it('trims the answer and the message', () => {
    expect(
      toReplies([
        {
          id: 'a',
          answer: '  Fixed.\n',
          message: '\n It eats a press.  ',
          created_at: SENT,
        },
      ]),
    ).toEqual([
      { id: 'a', answer: 'Fixed.', quote: { message: 'It eats a press.', sentAt: SENT } },
    ])
  })

  it('drops a row whose answer is only whitespace', () => {
    expect(
      toReplies([{ id: 'a', answer: '   ', message: 'Hi.', created_at: SENT }]),
    ).toEqual([])
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

  // A server without the quote migration, a message somebody blanked, a date the platform
  // cannot read: the quote goes, the reply stays. An answer with no question in front of
  // it is worse than one with; it is far better than none.
  it('keeps the reply and drops the quote when the message is missing', () => {
    expect(toReplies([{ id: 'a', answer: 'Fixed.' }])).toEqual([
      { id: 'a', answer: 'Fixed.', quote: null },
    ])
  })

  it('drops the quote when the message is only whitespace', () => {
    expect(
      toReplies([{ id: 'a', answer: 'Fixed.', message: '  ', created_at: SENT }]),
    ).toEqual([{ id: 'a', answer: 'Fixed.', quote: null }])
  })

  it('drops the quote when the date is missing or unreadable', () => {
    expect(toReplies([{ id: 'a', answer: 'Fixed.', message: 'Hi.' }])).toEqual([
      { id: 'a', answer: 'Fixed.', quote: null },
    ])
    expect(
      toReplies([
        { id: 'a', answer: 'Fixed.', message: 'Hi.', created_at: 'one tuesday' },
      ]),
    ).toEqual([{ id: 'a', answer: 'Fixed.', quote: null }])
  })
})

describe('sentOnLabel', () => {
  // The order of day, month and year is Intl's business, not this function's — en puts the
  // month first and cs the day, and both are right in their own language. What the label
  // promises is the month named rather than numbered, the year, and upper case.
  it('dates the quote in the player language, upper case', () => {
    const en = sentOnLabel(SENT, 'en')
    expect(en).toContain('SEP')
    expect(en).toContain('2026')
    expect(en).toBe(en.toLocaleUpperCase('en'))

    const cs = sentOnLabel(SENT, 'cs')
    expect(cs).toContain('2026')
    expect(cs).toBe(cs.toLocaleUpperCase('cs'))
    expect(cs).not.toBe(en)
  })

  it('falls back to the ISO day when the locale is one Intl refuses', () => {
    expect(sentOnLabel(SENT, 'not a locale')).toBe('2026-09-23')
  })
})
