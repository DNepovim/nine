import { describe, expect, it } from 'vitest'

import { sessionVerdict } from '@/lib/session-verdict'

const reads = (over: Partial<Parameters<typeof sessionVerdict>[0]> = {}) => ({
  profileError: null,
  profileFound: true,
  accountError: null,
  ...over,
})

describe('sessionVerdict', () => {
  it('stands when every read answered', () => {
    expect(sessionVerdict(reads())).toBe('live')
  })

  // The restore: device B took the profile and revoked this session. The profile row is
  // still there — it is somebody's, just not this device's any more.
  it('is revoked when the auth server refuses a session whose profile is still there', () => {
    const refusal = { message: 'Session from session_id claim in JWT does not exist' }
    expect(sessionVerdict(reads({ accountError: refusal }))).toBe('revoked')
  })

  // The same refusal with the row gone is the user themselves gone. Telling this player
  // their profile moved to another phone would be a lie, and the one that matters: every
  // local `db:reset` wipes the auth schema out from under every device at once.
  it('is gone, not revoked, when the profile row went with the session', () => {
    const refusal = { message: 'User from sub claim in JWT does not exist' }
    expect(sessionVerdict(reads({ accountError: refusal, profileFound: false }))).toBe(
      'gone',
    )
  })

  it('is gone when the row is absent from a server that answered', () => {
    expect(sessionVerdict(reads({ profileFound: false }))).toBe('gone')
  })

  // The whole point of the network check. A player in a tunnel keeps their profile.
  it('stands when the auth read never arrived', () => {
    const offline = { message: 'Network request failed' }
    expect(sessionVerdict(reads({ accountError: offline }))).toBe('live')
  })

  it('stands when the profile read never arrived, however the account read went', () => {
    const offline = { message: 'Failed to fetch' }
    expect(sessionVerdict(reads({ profileError: offline, profileFound: false }))).toBe(
      'live',
    )
    expect(
      sessionVerdict(
        reads({
          profileError: offline,
          profileFound: false,
          accountError: { message: 'Load failed' },
        }),
      ),
    ).toBe('live')
  })

  // A refused profile read that is not a lost connection — RLS, a 500 — says nothing
  // about the session. Nothing has been taken; the launch carries on with no nickname.
  it('stands when the profile read was refused but the session was not', () => {
    expect(
      sessionVerdict(
        reads({ profileError: { message: 'permission denied' }, profileFound: false }),
      ),
    ).toBe('live')
  })
})
