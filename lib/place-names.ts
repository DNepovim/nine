// What the places on an arcade map are called.
//
// Curated morphemes, never generated phonotactics. A proper onset-nucleus-coda grammar was
// tried first and it produces Grarsh, Drirrkhollow and Crorghbridge — sounds rather than
// names. Every part below is a real word or a real English place-name element, so the worst
// a bad roll can do is sound unfamiliar.
//
// Seeded from the crossroad's own id, so a village is called the same thing every time the
// player walks back to it. Proper nouns, so nothing here is ever translated.

// Head elements: each one a word or a word-shaped stem.
const HEAD = [
  'Ash',
  'Bram',
  'Brack',
  'Brand',
  'Birch',
  'Black',
  'Bran',
  'Cald',
  'Carn',
  'Corn',
  'Crag',
  'Dun',
  'Dern',
  'Dur',
  'East',
  'Elm',
  'Fal',
  'Fen',
  'Garth',
  'Glen',
  'Grim',
  'Hal',
  'Hart',
  'Hask',
  'Haw',
  'Heath',
  'Hern',
  'Hol',
  'Ked',
  'Kil',
  'Lang',
  'Linn',
  'Mar',
  'Mel',
  'Mor',
  'Murk',
  'Nor',
  'Oak',
  'Orm',
  'Pen',
  'Quar',
  'Ran',
  'Raven',
  'Red',
  'Rook',
  'Row',
  'Sal',
  'Shep',
  'Stan',
  'Stone',
  'Stour',
  'Thorn',
  'Til',
  'Tol',
  'Tor',
  'Trev',
  'Wal',
  'Wark',
  'Wen',
  'West',
  'Whit',
  'Win',
  'Wold',
  'Wyn',
  'Yar',
] as const

// Real place-name endings, joined straight onto a head. This is the part that does the
// work: it is why Brackford reads as a place and Brackex does not.
const TAIL = [
  'ford',
  'ton',
  'ham',
  'wick',
  'mere',
  'dale',
  'holt',
  'combe',
  'thorpe',
  'stead',
  'moor',
  'fell',
  'marsh',
  'bury',
  'gate',
  'hollow',
  'reach',
  'haven',
  'bridge',
  'well',
  'field',
  'wood',
  'burn',
  'shaw',
  'ridge',
  'bourne',
  'worth',
  'by',
  'cote',
  'croft',
  'mouth',
  'side',
  'barrow',
  'cross',
] as const

// The heads that can stand as a word on their own — bare, or in front of a second word. A
// list rather than a rule, because what reads as a place is not a shape: Dun and Fen and
// Stour do, Hask and Quar and Wen do not.
const STANDALONE = [
  'Ash',
  'Brand',
  'Crag',
  'Dun',
  'Fen',
  'Garth',
  'Glen',
  'Grim',
  'Hart',
  'Heath',
  'Linn',
  'Mar',
  'Oak',
  'Raven',
  'Rook',
  'Stone',
  'Stour',
  'Thorn',
  'Tor',
  'Wold',
] as const

// The same endings again, set as a second word — which is how a map labels the bigger ones.
const WORD_TAIL = [
  'Cross',
  'Barrow',
  'Haven',
  'Reach',
  'Mere',
  'Combe',
  'Hollow',
  'Bridge',
  'Ford',
  'Gate',
  'Fell',
  'Moor',
] as const

const PREFIX = [
  'North',
  'South',
  'Old',
  'New',
  'Little',
  'Upper',
  'Nether',
  'Great',
] as const

// Long enough for every name the lists can make, short enough to sit under a village
// without reaching its neighbours. Anything longer is rolled again rather than truncated —
// a truncated name is a bug the player can see.
const MAX_NAME = 13

const VOWELS = 'aeiouy'

const endConsonants = (word: string): number => {
  let n = 0
  for (
    let i = word.length - 1;
    i >= 0 && !VOWELS.includes(word[i]?.toLowerCase() ?? '');
    i--
  ) {
    n++
  }
  return n
}

const startConsonants = (word: string): number => {
  let n = 0
  for (
    let i = 0;
    i < word.length && !VOWELS.includes(word[i]?.toLowerCase() ?? '');
    i++
  ) {
    n++
  }
  return n
}

// The join rule. Three consonants meeting is a cluster no English name has, so Ash + shaw
// is rolled again rather than becoming Ashshaw; and a letter that would double at the seam
// is rolled again too, because collapsing it gives Wold + dale = Woldale, a word nobody
// reads twice.
function joins(head: string, tail: string): boolean {
  if (endConsonants(head) + startConsonants(tail) > 3) return false
  return head.slice(-1).toLowerCase() !== tail[0]
}

// The run's own randomness, so the same seed names the same place. Same generator the map
// itself is grown from — see machines/arcade.ts.
type Rng = () => number

const pick = <T>(items: readonly T[], rng: Rng): T =>
  items[Math.floor(rng() * items.length)] as T

// One attempt at a name, or null where the parts refused to join. Separate from the loop
// below so that "which shape of name is this" and "is this name usable" stay two questions.
function compose(rng: Rng, town: boolean): string | null {
  const roll = rng()
  if (town && roll < 0.5) {
    const head = pick(HEAD, rng)
    const tail = pick(TOWN_TAIL, rng)
    return joins(head, tail) ? head + tail : null
  }
  if (roll < 0.76) {
    const head = pick(HEAD, rng)
    const tail = pick(TAIL, rng)
    return joins(head, tail) ? head + tail : null
  }
  if (roll < 0.93) {
    const stem = pick(STANDALONE, rng)
    const word = pick(WORD_TAIL, rng)
    // Raven Haven is a rhyme, not a place.
    return stem.toLowerCase() === word.toLowerCase() ? null : `${stem} ${word}`
  }
  return pick(STANDALONE, rng)
}

// What one settlement is called. `town` opens the grander endings — a port, a hold, a
// minster — which is the only way the two kinds of place differ in name.
export function settlementName(rng: Rng, town = false): string {
  for (let attempt = 0; attempt < 12; attempt++) {
    const composed = compose(rng, town)
    if (composed === null) continue
    // A leading word, and only onto a name that is one word already: New Mar Mere is a
    // label, not a place, and two words is as far as a name on a 34pt disc can go.
    const prefix = rng() < 0.08 && !composed.includes(' ') ? pick(PREFIX, rng) : null
    const name =
      prefix !== null && prefix.length + 1 + composed.length <= MAX_NAME
        ? `${prefix} ${composed}`
        : composed
    if (name.length <= MAX_NAME) return name
  }
  // Twelve rolls that all collided is not a case worth modelling, and the fallback is the
  // most famous village in the genre.
  return 'Bree'
}

// A town is a port and a seat, so it gets endings a village never has.
const TOWN_TAIL = [
  'port',
  'gard',
  'hold',
  'keep',
  'garth',
  'minster',
  'castle',
  'haven',
  'gate',
  'watch',
] as const
