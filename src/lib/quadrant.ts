import type { Quadrant } from './types'

export const QUADRANTS: Quadrant[] = [
  'urgent_important',
  'important',
  'urgent',
  'neither',
]

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  urgent_important: 'Urgent & Important',
  important: 'Important',
  urgent: 'Urgent',
  neither: 'Neither',
}

export const QUADRANT_SHORT: Record<Quadrant, string> = {
  urgent_important: 'U·I',
  important: 'Imp',
  urgent: 'Urg',
  neither: '—',
}

export const QUADRANT_COLOR: Record<Quadrant, string> = {
  urgent_important: '#8c3b3b',
  important: '#3c5a48',
  urgent: '#8a6d3b',
  neither: '#7a7469',
}
