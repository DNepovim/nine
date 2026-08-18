// A run's length, in the clipped register the stat row uses elsewhere — M:SS, seconds
// always two digits. Minutes are left unpadded and uncapped: an hour-long Trainee
// session reads as "62:04" rather than wrapping into an hours column nothing else in
// the app has a slot for.
//
// Floors rather than rounds, so the number never claims a second of play that had not
// finished yet — the same reasoning `timeAgo` applies to a bucket boundary.
export function formatGameTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
