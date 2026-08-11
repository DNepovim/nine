import { describe, expect, it } from 'vitest'

import { GRAYSCALE } from '@/constants/colors'
import { DARK_MODE_GRADIENT } from '@/machines/modes'

import { announcementStyle } from './announcement-style'
import { ANNOUNCEMENT_IDS } from './announcements'

const LOST = ['todayLost', 'weekLost', 'everLost'] as const
const RAISED = ['todayRaised', 'weekRaised', 'everRaised'] as const

describe('announcementStyle', () => {
  it('gives every announcement a bar and at least one particle colour', () => {
    for (const id of ANNOUNCEMENT_IDS) {
      const style = announcementStyle(id, 'speed')
      expect(style.from).toMatch(/^#[0-9a-f]{6}$/i)
      expect(style.to).toMatch(/^#[0-9a-f]{6}$/i)
      expect(style.ink).toMatch(/^#[0-9a-f]{6}$/i)
      expect(style.colors.length).toBeGreaterThan(0)
    }
  })

  it('dresses a lost record in greyscale', () => {
    for (const id of LOST) {
      expect(announcementStyle(id, 'accuracy')).toMatchObject({
        from: GRAYSCALE[0],
        to: GRAYSCALE[1],
      })
    }
  })

  it('falls the implosion in greyscale, not the bar colours', () => {
    for (const id of LOST) {
      expect(announcementStyle(id, 'speed').colors).toEqual(GRAYSCALE)
    }
  })

  it('dresses a raised record in the CTA gradient', () => {
    for (const id of RAISED) {
      const [from, to] = DARK_MODE_GRADIENT.speed
      expect(announcementStyle(id, 'speed')).toMatchObject({ from, to })
    }
  })

  it('follows the mode for the CTA scale', () => {
    expect(announcementStyle('weekRaised', 'trainee').from).not.toBe(
      announcementStyle('weekRaised', 'speed').from,
    )
  })

  it('holds greyscale steady whatever the mode — a loss is not mode-flavoured', () => {
    expect(announcementStyle('weekLost', 'trainee')).toEqual(
      announcementStyle('weekLost', 'speed'),
    )
  })

  it('holds the fixed scales steady whatever the mode', () => {
    for (const id of ['record', 'today', 'week', 'ever'] as const) {
      expect(announcementStyle(id, 'trainee')).toEqual(announcementStyle(id, 'speed'))
    }
  })

  it('puts dark ink on gold and light ink everywhere else', () => {
    // White on gold is about 1.5:1 — the one place the ink has to change.
    for (const id of ['today', 'week', 'ever'] as const) {
      expect(announcementStyle(id, 'speed').ink).toBe('#1C1928')
    }
    expect(announcementStyle('record', 'speed').ink).toBe('#FFFFFF')
    expect(announcementStyle('everRaised', 'speed').ink).toBe('#D8D2F4')
    expect(announcementStyle('everLost', 'speed').ink).toBe('#FFFFFF')
  })
})
