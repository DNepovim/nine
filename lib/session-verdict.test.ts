import { describe, expect, it } from 'vitest'

import { sessionVerdict } from '@/lib/session-verdict'

// `accountRetryable` defaults false: the interesting default is a refusal that supabase-js
// did *not* excuse, because that is the only shape that can take anything away. A test
// about an outage says so explicitly.
const reads = (over: Partial<Parameters<typeof sessionVerdict>[0]> = {}) => ({
  profileError: null,
  profileFound: true,
  accountError: null,
  accountRetryable: false,
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

  // The outage. Both reads arrived somewhere and neither came back, which is what a bad
  // five minutes at the provider looks like from here: not a lost connection, so
  // `isNetworkFailure` passes it through, and not a refusal either — nobody has taken
  // anything from anybody. Before the pairing this answered 'revoked', and a player with
  // no address lost their career to it.
  it('stands when the server answered both reads badly', () => {
    const outages = [
      'upstream connect error or disconnect/reset before headers',
      'Request rate limit reached',
      'Internal Server Error',
      'Service Unavailable',
    ]
    for (const message of outages) {
      expect(
        sessionVerdict(
          reads({
            profileError: { message },
            profileFound: false,
            accountError: { message },
          }),
        ),
      ).toBe('live')
    }
  })

  // The one the pairing alone could not catch, and the likeliest real incident: GoTrue is
  // down and PostgREST is not. The profile row serves perfectly, so the two reads agree —
  // and they agree about nothing. Only supabase-js calling its own error retryable saves
  // this player.
  it('stands when auth alone is down and the profile row reads perfectly', () => {
    expect(
      sessionVerdict(
        reads({
          accountError: { message: 'upstream connect error' },
          accountRetryable: true,
        }),
      ),
    ).toBe('live')
  })

  // And the same read, not excused by the client, is the restore it has always been. The
  // retryable flag must not be a blanket amnesty.
  it('is still revoked when the refusal is not retryable', () => {
    expect(
      sessionVerdict(
        reads({
          accountError: {
            message: 'Session from session_id claim in JWT does not exist',
          },
          accountRetryable: false,
        }),
      ),
    ).toBe('revoked')
  })

  // The same thing one step less total: the auth read refused and the profile read merely
  // failed. A refusal is only evidence when it sits beside a read that worked, so this is
  // still not enough to take anything away.
  it('stands when the auth read refused but the profile read did not answer', () => {
    expect(
      sessionVerdict(
        reads({
          profileError: { message: 'Internal Server Error' },
          profileFound: false,
          accountError: {
            message: 'Session from session_id claim in JWT does not exist',
          },
        }),
      ),
    ).toBe('live')
  })
})
