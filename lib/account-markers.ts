import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  EMAIL_CODE_KEY,
  EMAIL_PROMPT_KEY,
  EMAIL_SENT_KEY,
  PROFILE_MOVED_KEY,
} from '@/constants/storage'

// The four bits the address work keeps on the device, and nothing else.
//
// Two are answered by presence alone and two carry a value, but none of them has a shape:
// a flag, a moment and an address are each one scalar, so there is nothing to parse and
// nothing to go wrong in the parsing — the one read that could, the moment, is guarded by
// `Number.isFinite` and falls back to having no answer. That is why this file has no test
// beside it and `lib/welcome.ts` does: there is no pure function here, only storage.
// `lib/retired-storage.ts` is the same arrangement.
//
// Every read swallows its own failure. Storage being unavailable — Safari in a private
// window throws on access rather than answering — must not take the intro down, and the
// cost of guessing wrong is one card shown twice or one line not shown at all.

const SET = '1'

const has = async (key: string): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(key)) !== null
  } catch {
    return false
  }
}

const mark = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, SET)
  } catch {
    // ignore — the worst of it is being asked the same question again next launch
  }
}

const unmark = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key)
  } catch {
    // ignore — as above, in the other direction
  }
}

// Has this player already been asked, once, to put an address on their profile?
export const wasEmailAsked = (): Promise<boolean> => has(EMAIL_PROMPT_KEY)
export const markEmailAsked = (): Promise<void> => mark(EMAIL_PROMPT_KEY)

// Was a profile taken off this device by a restore somewhere else?
//
// Unlike the ask above, this one is cleared rather than only set: the line it draws under
// the intro's title stays up until the player taps it, because "your profile moved to
// another phone" is worth saying until it has been read, and the tap is what reads it.
export const wasProfileMoved = (): Promise<boolean> => has(PROFILE_MOVED_KEY)
export const markProfileMoved = (): Promise<void> => mark(PROFILE_MOVED_KEY)
export const clearProfileMoved = (): Promise<void> => unmark(PROFILE_MOVED_KEY)

// When a code last went out, so the resend cooldown outlives the process. Null is "no
// answer" and never "ready": a missing or unreadable value leaves the button to the
// server's judgement, which is where it was before any of this.
export const lastCodeSentAt = async (): Promise<number | null> => {
  try {
    const raw = await AsyncStorage.getItem(EMAIL_SENT_KEY)
    if (raw === null) return null
    const at = Number(raw)
    return Number.isFinite(at) ? at : null
  } catch {
    return null
  }
}

export const markCodeSent = async (at: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(EMAIL_SENT_KEY, String(at))
  } catch {
    // ignore — the cooldown falls back to the life of this process
  }
}

// The address a code card is up for, and the means to put it down. Cleared rather than
// only set, because a card that is finished with must not reopen on the next launch.
export const openCodeAddress = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(EMAIL_CODE_KEY)
  } catch {
    return null
  }
}

export const markCodeCard = async (address: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(EMAIL_CODE_KEY, address)
  } catch {
    // ignore — the card simply does not come back, which is today's behaviour
  }
}

export const clearCodeCard = (): Promise<void> => unmark(EMAIL_CODE_KEY)
