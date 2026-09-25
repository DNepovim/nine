import { describe, expect, it } from 'vitest'

import { shortName } from './short-name'

describe('shortName', () => {
  it('leaves a name that fits exactly as it is', () => {
    expect(shortName('Dominik', 12)).toBe('Dominik')
  })

  it('leaves a name of exactly the cap alone', () => {
    expect(shortName('Bartholomew1', 12)).toBe('Bartholomew1')
  })

  it('cuts a longer name and marks the cut', () => {
    expect(shortName('Bartholomew12345', 12)).toBe('Bartholomew…')
  })

  it('never returns more characters than the cap', () => {
    expect(Array.from(shortName('MMMMMMMMMMMMMMMM', 12))).toHaveLength(12)
  })

  it('counts an emoji as the one character it looks like', () => {
    expect(shortName('🎯🎯🎯', 3)).toBe('🎯🎯🎯')
    expect(shortName('🎯🎯🎯🎯', 3)).toBe('🎯🎯…')
  })

  it('keeps a combining mark with the letter it belongs to', () => {
    expect(shortName('Žluťoučký kůň!!', 6)).toBe('Žluťo…')
  })
})
