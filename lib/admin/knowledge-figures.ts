// How the KNOWLEDGE screen writes a figure: a clock in seconds, a share as a percent, a
// row of figures one per rung or place.

export const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`

export const percent = (share: number): string => `${Math.round(share * 100)}%`

export const list = (values: readonly number[]): string => values.join(' / ')
