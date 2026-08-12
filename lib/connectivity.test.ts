import { describe, expect, it } from 'vitest'

import { isNetworkFailure, isOnline, noteRequest, setOnline } from './connectivity'

describe('isNetworkFailure', () => {
  it('recognises the Hermes wording', () => {
    expect(isNetworkFailure('Network request failed')).toBe(true)
  })

  it('recognises the browser wording', () => {
    expect(isNetworkFailure('TypeError: Failed to fetch')).toBe(true)
  })

  it('recognises a timeout', () => {
    expect(isNetworkFailure('Request timed out')).toBe(true)
  })

  it('ignores case', () => {
    expect(isNetworkFailure('LOAD FAILED')).toBe(true)
  })

  it('treats a rejected write as the server answering', () => {
    expect(
      isNetworkFailure('new row violates row-level security policy for table "scores"'),
    ).toBe(false)
  })

  it('treats an empty message as the server answering', () => {
    expect(isNetworkFailure('')).toBe(false)
  })
})

describe('noteRequest', () => {
  it('goes offline when a request never reached the server', () => {
    setOnline(true)
    noteRequest({ message: 'Network request failed' })
    expect(isOnline()).toBe(false)
  })

  it('comes back online as soon as one answers', () => {
    setOnline(false)
    noteRequest(null)
    expect(isOnline()).toBe(true)
  })

  it('stays online when the server rejects the request', () => {
    setOnline(true)
    noteRequest({ message: 'duplicate key value violates unique constraint' })
    expect(isOnline()).toBe(true)
  })
})
