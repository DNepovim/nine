import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { OPTIONS_KEY } from '@/constants/storage'
import { readPersisted } from '@/lib/hydration'

type StoredOptions = { showSum?: boolean }

// Advanced display options (show the button sum), persisted to AsyncStorage.
export function useDisplayOptions() {
  const [showSum, setShowSum] = useState(false)
  // Opened only by a read that actually came back. Setting this in a `finally` — which
  // is what it used to do — meant a read that threw opened the gate exactly as a
  // successful one did, and the next change wrote the default back over whatever the
  // player had chosen. Same defect, same fix, as `use-persisted-stats`.
  const mayPersist = useRef(false)

  useEffect(() => {
    void (async () => {
      const { value, mayPersist: allowed } = await readPersisted<StoredOptions>(
        AsyncStorage.getItem.bind(AsyncStorage),
        OPTIONS_KEY,
      )
      if (typeof value?.showSum === 'boolean') setShowSum(value.showSum)
      mayPersist.current = allowed
    })()
  }, [])

  useEffect(() => {
    if (!mayPersist.current) return
    AsyncStorage.setItem(OPTIONS_KEY, JSON.stringify({ showSum })).catch(() => {})
  }, [showSum])

  const toggleSum = useCallback(() => {
    setShowSum((value) => !value)
  }, [])

  return { showSum, toggleSum }
}
