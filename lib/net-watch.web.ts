// The browser says when the connection drops and when it comes back, so the web build
// learns both without waiting for a request to fail. `navigator.onLine` promises a
// network, not a reachable server, so 'online' is only ever a hint to retry — the next
// request decides.
export function watchNetwork(onChange: (online: boolean) => void): () => void {
  const goOnline = () => {
    onChange(true)
  }
  const goOffline = () => {
    onChange(false)
  }
  window.addEventListener('online', goOnline)
  window.addEventListener('offline', goOffline)
  return () => {
    window.removeEventListener('online', goOnline)
    window.removeEventListener('offline', goOffline)
  }
}
