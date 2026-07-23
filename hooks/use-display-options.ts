import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { OPTIONS_KEY } from '@/constants/storage'

// Advanced display options (show the button sum), persisted to AsyncStorage.
export function useDisplayOptions() {
  const [showSum, setShowSum] = useState(false)
  const hydrated = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(OPTIONS_KEY)
      .then((raw) => {
        if (!raw) return
        const options = JSON.parse(raw) as { showSum?: boolean }
        if (typeof options.showSum === 'boolean') setShowSum(options.showSum)
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    AsyncStorage.setItem(OPTIONS_KEY, JSON.stringify({ showSum })).catch(() => {})
  }, [showSum])

  const toggleSum = useCallback(() => {
    setShowSum((value) => !value)
  }, [])

  return { showSum, toggleSum }
}
