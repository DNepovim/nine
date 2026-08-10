// Announcements take over the best-scores bar for a moment when something worth
// saying happens mid-run. Adding one means adding an id and its message here.
export type AnnouncementId = 'record'

export type Announcement = { id: AnnouncementId; message: string }

const ANNOUNCEMENT_MESSAGES = {
  record: 'YOU BEAT YOUR BEST',
} as const satisfies Record<AnnouncementId, string>

export const announcementFor = (id: AnnouncementId): Announcement => ({
  id,
  message: ANNOUNCEMENT_MESSAGES[id],
})

// A record is only broken when there was one to beat — a player's first scoring run
// sets the bar rather than breaking it, and equalling it is not beating it.
export const brokeOwnRecord = (score: number, bestAtRunStart: number): boolean =>
  bestAtRunStart > 0 && score > bestAtRunStart
