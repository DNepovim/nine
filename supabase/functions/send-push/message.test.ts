import { describe, expect, it } from 'vitest'

import { CHALLENGES as CATALOG } from '@/modes/challenges/catalog'

import { CHALLENGES, passedMessage, takeoverMessage } from './message'

const taken = {
  mode: 'accuracy',
  difficulty: 'hard',
  period: 'ever',
  byNickname: 'ŽLUŤOUČEK',
} as const

describe('takeoverMessage', () => {
  it('speaks English to an English subscriber', () => {
    expect(takeoverMessage('en', taken).body).toBe(
      'ŽLUŤOUČEK took your record — ACCURACY, HARD.',
    )
  })

  it('speaks Czech to a Czech one', () => {
    const message = takeoverMessage('cs', {
      ...taken,
      mode: 'speed',
      difficulty: 'extreme',
    })
    expect(message.title).toBe('Rekord všech dob je pryč')
    expect(message.body).toBe('ŽLUŤOUČEK ti vzal rekord — RYCHLOST, EXTRÉMNÍ.')
  })

  it('keeps a ten-character nickname whole', () => {
    const nick = 'WWWWWWWWWW'
    expect(takeoverMessage('en', { ...taken, byNickname: nick }).body).toContain(nick)
  })

  it('says in the title which period was lost', () => {
    expect(takeoverMessage('en', { ...taken, period: 'day' }).title).toBe(
      'Your daily record is gone',
    )
    expect(takeoverMessage('en', { ...taken, period: 'week' }).title).toBe(
      'Your weekly record is gone',
    )
    expect(takeoverMessage('cs', { ...taken, period: 'day' }).title).toBe(
      'Denní rekord je pryč',
    )
    expect(takeoverMessage('cs', { ...taken, period: 'week' }).title).toBe(
      'Týdenní rekord je pryč',
    )
  })

  it('tags by board and period so a second takeover replaces the first, not the other period', () => {
    expect(takeoverMessage('en', taken).tag).toBe('takeover-accuracy-hard-ever')
    expect(takeoverMessage('en', { ...taken, period: 'day' }).tag).not.toBe(
      takeoverMessage('en', taken).tag,
    )
  })

  it('shows a board it has no word for as it came', () => {
    expect(takeoverMessage('en', { ...taken, mode: 'blitz' }).body).toContain('BLITZ')
  })
})

describe('passedMessage', () => {
  const passed = { challenge: 'challenge/drift', byNickname: 'ŽLUŤOUČEK' }

  it('names the challenge in English', () => {
    const message = passedMessage('en', passed)
    expect(message.title).toBe('You lost the lead')
    expect(message.body).toBe('ŽLUŤOUČEK passed you in LAVA.')
  })

  it('names it in Czech, by its Czech name', () => {
    const message = passedMessage('cs', passed)
    expect(message.title).toBe('Přišel jsi o vedení')
    expect(message.body).toBe('ŽLUŤOUČEK je ve výzvě LÁVA před tebou.')
  })

  it('keeps a ten-character nickname whole', () => {
    const nick = 'WWWWWWWWWW'
    expect(passedMessage('en', { ...passed, byNickname: nick }).body).toContain(nick)
  })

  it('tags by challenge', () => {
    expect(passedMessage('en', passed).tag).toBe('passed-drift')
  })

  it('shows a challenge it has no word for as it came', () => {
    expect(
      passedMessage('en', { ...passed, challenge: 'challenge/zigzag' }).body,
    ).toContain('ZIGZAG')
  })
})

describe('the challenge names', () => {
  const slugs = CATALOG.map((c) => c.id.replace('challenge/', ''))

  it('has an English and a Czech name for every challenge in the catalog', () => {
    expect(slugs.length).toBeGreaterThan(0)
    for (const slug of slugs) {
      expect(CHALLENGES.en[slug], `en ${slug}`).toBeTruthy()
      expect(CHALLENGES.cs[slug], `cs ${slug}`).toBeTruthy()
    }
  })

  it('spells each English name as the catalog does, soft hyphens aside', () => {
    for (const c of CATALOG) {
      const slug = c.id.replace('challenge/', '')
      const label = (c.label.message ?? '').replaceAll('\u00ad', '')
      expect(CHALLENGES.en[slug], slug).toBe(label)
    }
  })

  it('has no name for a challenge that is not in the catalog', () => {
    expect(new Set(Object.keys(CHALLENGES.en))).toEqual(new Set(slugs))
  })
})
