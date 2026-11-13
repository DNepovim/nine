import { describe, expect, it } from 'vitest'

import { introStanding, isMenuScreen, welcomeStanding } from './intro-standing'

describe('isMenuScreen', () => {
  it('is false with nothing open', () => {
    expect(isMenuScreen('none')).toBe(false)
  })

  it('is false for the two dialogs, which leave the screen under them drawn', () => {
    expect(isMenuScreen('advanced')).toBe(false)
    expect(isMenuScreen('howToPlay')).toBe(false)
  })

  it('is true for the overlays that replace the screen they were opened from', () => {
    expect(isMenuScreen('news')).toBe(true)
    expect(isMenuScreen('joinRoom')).toBe(true)
    expect(isMenuScreen('admin')).toBe(true)
  })
})

describe('introStanding', () => {
  it('is drawn and alone at the intro with nothing over it', () => {
    expect(introStanding(true, 'none')).toEqual({ drawn: true, alone: true })
  })

  it('stays drawn but not alone under a dialog', () => {
    expect(introStanding(true, 'advanced')).toEqual({ drawn: true, alone: false })
  })

  it('comes down under a screen of its own', () => {
    expect(introStanding(true, 'news')).toEqual({ drawn: false, alone: false })
  })

  it('is neither away from the intro', () => {
    expect(introStanding(false, 'none')).toEqual({ drawn: false, alone: false })
  })
})

describe('welcomeStanding', () => {
  it('offers the tutorial once the splash is done and the intro is alone', () => {
    expect(welcomeStanding(true, true, true)).toEqual({ offer: true, free: false })
  })

  it('holds the offer back until the splash is done, and keeps the intro busy meanwhile', () => {
    expect(welcomeStanding(true, false, true)).toEqual({ offer: false, free: false })
  })

  it('frees the intro for the other asks once nothing is owed', () => {
    expect(welcomeStanding(true, true, false)).toEqual({ offer: false, free: true })
  })

  it('offers nothing and frees nothing while the intro is not alone', () => {
    expect(welcomeStanding(false, true, true)).toEqual({ offer: false, free: false })
    expect(welcomeStanding(false, true, false)).toEqual({ offer: false, free: false })
  })
})
