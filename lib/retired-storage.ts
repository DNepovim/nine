import AsyncStorage from '@react-native-async-storage/async-storage'

import { RETIRED_KEYS } from '@/constants/storage'

// Clears the keys no build reads any more. Called once on boot, and harmless to repeat:
// removing a key that is already gone is not an error.
//
// It runs for its own sake rather than to make room — a retired key is data the app has
// decided is wrong, and leaving it on disk means the next person to go looking finds two
// answers to the same question.
export async function purgeRetiredStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...RETIRED_KEYS])
  } catch {
    // ignore — nothing downstream reads these, so failing to clear them costs nothing
  }
}
