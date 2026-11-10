import { describe, expect, it } from 'vitest'

import { vapidKeyBytes } from '@/lib/push-key'

describe('vapidKeyBytes', () => {
  it('decodes base64url without padding', () => {
    // "hello" is aGVsbG8 unpadded.
    expect([...vapidKeyBytes('aGVsbG8')]).toEqual([104, 101, 108, 108, 111])
  })

  it('reads the URL-safe alphabet as the standard one', () => {
    // 0xfb 0xff is "-_8" in base64url and "+/8=" in base64.
    expect([...vapidKeyBytes('-_8')]).toEqual([0xfb, 0xff])
  })

  it('needs no padding to be right at any length', () => {
    expect(vapidKeyBytes('YQ')).toHaveLength(1)
    expect(vapidKeyBytes('YWI')).toHaveLength(2)
    expect(vapidKeyBytes('YWJj')).toHaveLength(3)
  })
})
