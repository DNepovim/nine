import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { OPTIONS_KEY } from '@/constants/storage'

// Advanced display options (show the button sum / the row×col factor),
// persisted to AsyncStorage.
export function useDisplayOptions() {
  const [showSum, setShowSum] = useState(false)
  const [showFactor, setShowFactor] = useState(false)
  const hydrated = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(OPTIONS_KEY)
      .then((raw) => {
        if (!raw) return
        const options = JSON.parse(raw) as { showSum?: boolean; showFactor?: boolean }
        if (typeof options.showSum === 'boolean') setShowSum(options.showSum)
        if (typeof options.showFactor === 'boolean') setShowFactor(options.showFactor)
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    AsyncStorage.setItem(OPTIONS_KEY, JSON.stringify({ showSum, showFactor })).catch(
      () => {},
    )
  }, [showSum, showFactor])

  const toggleSum = useCallback(() => {
    setShowSum((value) => !value)
  }, [])
  const toggleFactor = useCallback(() => {
    setShowFactor((value) => !value)
  }, [])

  return { showSum, showFactor, toggleSum, toggleFactor }
}
