// The OS-level connectivity signal, where there is one.
//
// Native has none without a connectivity library, so reachability there is learned
// from failed requests and the retry that follows. The web build overrides this file.
export const watchNetwork = (_onChange: (online: boolean) => void): (() => void) => {
  return () => {}
}
