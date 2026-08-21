import { addDays, format, startOfWeek } from 'date-fns'
import type { ScheduleBlock } from './types'

export const PX_PER_MIN = 1.2

/** Local calendar date -> 'yyyy-MM-dd' (never goes through UTC). */
export function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** 'yyyy-MM-dd' -> local Date at midnight (avoids the UTC parse of new Date('yyyy-MM-dd')). */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function nowMin(): number {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

export function snap15(min: number): number {
  return Math.round(min / 15) * 15
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 510 -> '08:30' */
export function minToLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 90 -> '1h 30m', 60 -> '1h', 45 -> '45m' */
export function durationLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Monday-first week containing `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function weekStartStr(anchor: Date): string {
  return toDateStr(startOfWeek(anchor, { weekStartsOn: 1 }))
}

export type LaidOutBlock = ScheduleBlock & { lane: number; laneCount: number }

/**
 * Assign overlapping blocks of one day to side-by-side lanes.
 * Sweep sorted blocks, group mutually-overlapping clusters, give each block
 * the lowest free lane within its cluster.
 */
export function layoutDayBlocks(blocks: ScheduleBlock[]): LaidOutBlock[] {
  const sorted = [...blocks].sort(
    (a, b) => a.start_min - b.start_min || b.duration_min - a.duration_min,
  )
  const out: LaidOutBlock[] = []
  let cluster: LaidOutBlock[] = []
  let clusterEnd = -1
  let laneEnds: number[] = []

  const flush = () => {
    for (const b of cluster) b.laneCount = laneEnds.length
    out.push(...cluster)
    cluster = []
    laneEnds = []
  }

  for (const b of sorted) {
    if (b.start_min >= clusterEnd && cluster.length > 0) flush()
    let lane = laneEnds.findIndex((end) => end <= b.start_min)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = b.start_min + b.duration_min
    clusterEnd = Math.max(clusterEnd, b.start_min + b.duration_min)
    cluster.push({ ...b, lane, laneCount: 1 })
  }
  if (cluster.length > 0) flush()
  return out
}
