// Native builds update through the store or expo-updates, neither of which this
// controls. The web implementation lives in use-app-update.web.ts; this variant exists
// so the native bundle never reaches for a service worker.
export function useAppUpdate(): { ready: boolean; apply: () => void } {
  return { ready: false, apply: () => {} }
}
