// Sunday is the day the app is shut. Read off the device's own calendar, not Prague's: it
// is the player's Sunday that is meant to be kept free of the phone.
export const isRestDay = (now: Date): boolean => now.getDay() === 0
