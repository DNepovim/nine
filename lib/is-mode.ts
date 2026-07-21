import { MODE_ORDER, type Mode } from '@/machines/modes'

export const isMode = (value: string): value is Mode =>
  MODE_ORDER.some((mode) => mode === value)
