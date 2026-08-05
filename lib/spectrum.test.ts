import { describe, expect, it } from 'vitest'

import { sampleSpectrum, spreadSpectrum } from './spectrum'

const STOPS = ['#000000', '#808080', '#ffffff']

describe('sampleSpectrum', () => {
  it('returns the first stop at t = 0', () => {
    expect(sampleSpectrum(STOPS, 0)).toBe('#000000')
  })

  it('returns the last stop at t = 1', () => {
    expect(sampleSpectrum(STOPS, 1)).toBe('#ffffff')
  })

  it('lands on an interior stop at its exact position', () => {
    expect(sampleSpectrum(STOPS, 0.5)).toBe('#808080')
  })

  it('interpolates between two stops', () => {
    expect(sampleSpectrum(STOPS, 0.25)).toBe('#404040')
  })

  it('clamps out-of-range values to the end stops', () => {
    expect(sampleSpectrum(STOPS, -1)).toBe('#000000')
    expect(sampleSpectrum(STOPS, 4)).toBe('#ffffff')
  })

  it('falls back to black for an empty gradient', () => {
    expect(sampleSpectrum([], 0.5)).toBe('#000000')
  })

  it('returns the only stop of a single-stop gradient', () => {
    expect(sampleSpectrum(['#123456'], 0.7)).toBe('#123456')
  })
})

describe('spreadSpectrum', () => {
  it('spans the full gradient, ends included', () => {
    expect(spreadSpectrum(STOPS, 3)).toEqual(['#000000', '#808080', '#ffffff'])
  })

  it('returns the requested number of samples', () => {
    expect(spreadSpectrum(STOPS, 6)).toHaveLength(6)
  })

  it('returns a single sample for a count of one', () => {
    expect(spreadSpectrum(STOPS, 1)).toEqual(['#000000'])
  })
})
