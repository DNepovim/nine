import { describe, expect, it } from 'vitest'

import {
  addressProblem,
  authProblem,
  codeProblem,
  cooldownRemaining,
  normalizeEmail,
  RESEND_COOLDOWN_MS,
} from '@/lib/account-email'

describe('normalizeEmail', () => {
  it('trims the whitespace around it', () => {
    expect(normalizeEmail('  ace@nine.app  ')).toBe('ace@nine.app')
  })

  it('lower-cases it, because a phone capitalises the first letter of a field', () => {
    expect(normalizeEmail('Ace@Nine.App')).toBe('ace@nine.app')
  })
})

describe('addressProblem', () => {
  it('accepts an ordinary address', () => {
    expect(addressProblem('ace@nine.app')).toBeNull()
  })

  it('accepts a plus tag, which is a real address people really use', () => {
    expect(addressProblem('ace+nine@example.co.uk')).toBeNull()
  })

  it('accepts one that needs trimming and lower-casing first', () => {
    expect(addressProblem('  Ace@Nine.App ')).toBeNull()
  })

  it('refuses one with no @', () => {
    expect(addressProblem('ace.nine.app')).toBe('shape')
  })

  it('refuses one with nothing after the dot', () => {
    expect(addressProblem('ace@nine.')).toBe('shape')
  })

  it('refuses one with no dot in the domain at all', () => {
    expect(addressProblem('ace@nine')).toBe('shape')
  })

  it('refuses a space in the middle', () => {
    expect(addressProblem('ace nine@nine.app')).toBe('shape')
  })

  it('refuses an empty field', () => {
    expect(addressProblem('   ')).toBe('shape')
  })
})

describe('codeProblem', () => {
  it('accepts six digits', () => {
    expect(codeProblem('481516')).toBeNull()
  })

  it('accepts six digits with whitespace around them, as a paste brings them', () => {
    expect(codeProblem(' 481516\n')).toBeNull()
  })

  it('refuses five', () => {
    expect(codeProblem('48151')).toBe('bad_code')
  })

  it('refuses seven', () => {
    expect(codeProblem('4815162')).toBe('bad_code')
  })

  it('refuses letters', () => {
    expect(codeProblem('4815aa')).toBe('bad_code')
  })
})

describe('authProblem', () => {
  it('reads an address already on another profile as taken', () => {
    expect(
      authProblem({ code: 'email_exists', message: 'Email already registered' }),
    ).toBe('taken')
  })

  it('reads the other spelling of that as taken too', () => {
    expect(
      authProblem({ code: 'user_already_exists', message: 'User already registered' }),
    ).toBe('taken')
  })

  it('reads too many sends as rate limited', () => {
    expect(
      authProblem({ code: 'over_email_send_rate_limit', message: 'rate limit' }),
    ).toBe('rate_limited')
  })

  it('reads a refused code as expired — the server will not say which it was', () => {
    expect(
      authProblem({ code: 'otp_expired', message: 'Token has expired or is invalid' }),
    ).toBe('expired')
  })

  it('reads a rejected address as a shape problem', () => {
    expect(authProblem({ code: 'email_address_invalid', message: 'Invalid email' })).toBe(
      'shape',
    )
  })

  it('reads a lost connection as offline, whatever the code says', () => {
    expect(authProblem({ code: 'email_exists', message: 'Network request failed' })).toBe(
      'offline',
    )
  })

  it('reads a lost connection with no code at all as offline', () => {
    expect(authProblem({ message: 'Failed to fetch' })).toBe('offline')
  })

  it('falls back to unknown rather than throwing on a code it has never seen', () => {
    expect(authProblem({ code: 'weak_password', message: 'nope' })).toBe('unknown')
  })

  it('falls back to unknown when there is no code', () => {
    expect(authProblem({ message: 'something went wrong' })).toBe('unknown')
  })

  it('does not read an inherited object property as a known code', () => {
    expect(authProblem({ code: 'toString', message: 'nope' })).toBe('unknown')
  })
})

describe('cooldownRemaining', () => {
  it('is zero before anything has been sent', () => {
    expect(cooldownRemaining(null, 1_000)).toBe(0)
  })

  it('is the whole cooldown the instant a code goes out', () => {
    expect(cooldownRemaining(0, 0)).toBe(RESEND_COOLDOWN_MS / 1000)
  })

  it('counts down in whole seconds', () => {
    expect(cooldownRemaining(0, 10_000)).toBe(20)
  })

  it('rounds a part-second up, so the last tick never reads zero while it is dim', () => {
    expect(cooldownRemaining(0, 29_500)).toBe(1)
  })

  it('is zero exactly on the boundary', () => {
    expect(cooldownRemaining(0, RESEND_COOLDOWN_MS)).toBe(0)
  })

  it('is zero after it', () => {
    expect(cooldownRemaining(0, RESEND_COOLDOWN_MS + 5_000)).toBe(0)
  })

  it('treats a clock that went backwards as having sent just now', () => {
    expect(cooldownRemaining(10_000, 9_000)).toBe(RESEND_COOLDOWN_MS / 1000)
  })
})
