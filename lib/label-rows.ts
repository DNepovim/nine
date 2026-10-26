// The **soft hyphen** (U+00AD): the one way a mode's name says where it breaks.
//
// A challenge's name is drawn a word per row at a pinned size in the challenge dialog, and
// a single word too wide for a row — GLIMPSE, ZÁBLESK — carries one of these to say where
// it splits: GLIM / PSE, ZÁ / BLESK. Inside the label rather than beside it, because a
// translation breaks its own word in its own place. Everywhere a name is drawn on one line
// it is invisible, and where such a line happens to wrap at it, it draws as the hyphen a
// break there ought to have.
//
// Named here so the two places that have to know about it — the rows below, and
// `GradientText`, which would otherwise colour it as a letter — know it by one name.
export const SOFT_HYPHEN = '­'

// A name as the rows a wordmark draws it in: one word per row, split at spaces and at a
// soft hyphen.
//
// Collapses runs of either and drops the empties, so a name typed with two spaces does
// not produce a blank row.
export const labelRows = (label: string): string[] =>
  label.split(/[\s­]+/).filter((word) => word.length > 0)
