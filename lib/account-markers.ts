import AsyncStorage from '@react-native-async-storage/async-storage'

import { EMAIL_PROMPT_KEY, PROFILE_MOVED_KEY } from '@/constants/storage'

// The two bits the address work keeps on the device, and nothing else.
//
// Presence is the whole answer in both cases — there is no second field either of them
// could grow, and so no shape to parse and nothing to go wrong in the parsing. That is why
// this file has no test beside it and `lib/welcome.ts` does: there is no pure function
// here, only four touches of storage. `lib/retired-storage.ts` is the same arrangement.
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
