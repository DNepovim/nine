import type { ReactNode } from 'react'

// On a phone the app is already the right shape and fills the screen it was made
// for. The web build overrides this file to sit the app in a frame once the window
// is bigger than any phone.
export const PhoneFrame = ({ children }: { children: ReactNode }) => <>{children}</>
