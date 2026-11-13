import { describe, expect, it } from 'vitest'

import {
  accountNoticeFor,
  launchAsksClear,
  mayAskForEmail,
  mayOpenSessionAsk,
} from './launch-asks'

describe('accountNoticeFor', () => {
  it('says the profile moved before anything else', () => {
    expect(accountNoticeFor({ moved: true, pendingEmail: 'a@b.cz' })).toBe('moved')
  })

  it('asks for a confirmation while an address waits on its code', () => {
    expect(accountNoticeFor({ moved: false, pendingEmail: 'a@b.cz' })).toBe('confirm')
  })

  it('says nothing otherwise', () => {
    expect(accountNoticeFor({ moved: false, pendingEmail: null })).toBeNull()
  })
})

// Every ask in the queue clear, so each test turns on exactly the one thing it is about.
const QUEUE_CLEAR = {
  splashDone: true,
  onIntro: true,
  repliesReady: true,
  hasReply: false,
  newsReady: true,
  newsVisible: false,
  installing: false,
  consentVisible: false,
}

describe('mayOpenSessionAsk', () => {
  it('opens once every ask ahead of it has had its turn', () => {
    expect(mayOpenSessionAsk({ ...QUEUE_CLEAR, otherDialogUp: false })).toBe(true)
  })

  it('never opens over a dialog already up', () => {
    expect(mayOpenSessionAsk({ ...QUEUE_CLEAR, otherDialogUp: true })).toBe(false)
  })

  it.each([
    ['the splash is still up', { splashDone: false }],
    ['the player is not on the intro', { onIntro: false }],
    ['the replies have not been read', { repliesReady: false }],
    ['a reply is waiting', { hasReply: true }],
    ['the news has not been read', { newsReady: false }],
    ['the news is up', { newsVisible: true }],
    ['the install prompt is up', { installing: true }],
    ['a consent card is up', { consentVisible: true }],
  ])('waits while %s', (_, held) => {
    expect(mayOpenSessionAsk({ ...QUEUE_CLEAR, otherDialogUp: false, ...held })).toBe(
      false,
    )
  })
})

describe('mayAskForEmail', () => {
  const CLEAR = {
    ...QUEUE_CLEAR,
    titleDialogOpen: false,
    nicknameOpen: false,
    challengeUp: false,
  }

  it('asks once the whole queue is clear', () => {
    expect(mayAskForEmail(CLEAR)).toBe(true)
  })

  it.each([
    ['a title dialog is open', { titleDialogOpen: true }],
    ['the nickname card is open', { nicknameOpen: true }],
    ['a challenge dialog is open or owed', { challengeUp: true }],
    ['a reply is waiting', { hasReply: true }],
    ['the news is up', { newsVisible: true }],
    ['a consent card is up', { consentVisible: true }],
  ])('waits while %s', (_, held) => {
    expect(mayAskForEmail({ ...CLEAR, ...held })).toBe(false)
  })
})

describe('launchAsksClear', () => {
  const CLEAR = {
    splashDone: true,
    onIntro: true,
    repliesReady: true,
    hasReply: false,
    newsReady: true,
    newsVisible: false,
    challengeUp: false,
    installing: false,
    replayVisible: false,
  }

  it('is clear once every ask ahead of the push card has had its turn', () => {
    expect(launchAsksClear(CLEAR)).toBe(true)
  })

  it.each([
    ['the replay card is up', { replayVisible: true }],
    ['a challenge dialog is up', { challengeUp: true }],
    ['the news is up', { newsVisible: true }],
    ['the splash is still up', { splashDone: false }],
  ])('is not clear while %s', (_, held) => {
    expect(launchAsksClear({ ...CLEAR, ...held })).toBe(false)
  })
})
