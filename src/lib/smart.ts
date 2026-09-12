// The app's "smart" derivations: deadline-driven priority escalation,
// parent rollups from subtasks, and automatic free-slot scheduling.
import { addDays, format } from 'date-fns'
import { supabase } from './supabase'
import { clamp, fromDateStr, todayStr } from './time'
import type { PlanFields, Quadrant, ScheduleBlock, Task } from './types'

/** A task becomes urgent this many days before its deadline. */
export const ESCALATE_WITHIN_DAYS = 2

function addDaysStr(day: string, n: number): string {
  return format(addDays(fromDateStr(day), n), 'yyyy-MM-dd')
}

/**
 * Urgency follows the deadline: within ESCALATE_WITHIN_DAYS of the due date
 * (or past it), Important is treated as Urgent & Important and Neither as
 * Urgent. Purely derived — the stored quadrant never changes.
 */
export function effectiveQuadrant(quadrant: Quadrant, dueDate: string | null): Quadrant {
  if (!dueDate) return quadrant
  if (dueDate > addDaysStr(todayStr(), ESCALATE_WITHIN_DAYS)) return quadrant
  if (quadrant === 'important') return 'urgent_important'
  if (quadrant === 'neither') return 'urgent'
  return quadrant
}

export function isEscalated(quadrant: Quadrant, dueDate: string | null): boolean {
  return effectiveQuadrant(quadrant, dueDate) !== quadrant
}

export interface ParentRollup {
  /** sum of open subtasks' estimates (falls back to the parent's own) */
  estimateMin: number | null
  /** parent's own due date, else the latest subtask due date */
  dueDate: string | null
}

export function rollupParent(task: Task, children: Task[]): ParentRollup {
  if (children.length === 0) return { estimateMin: task.estimate_min, dueDate: task.due_date }
  // total effort = sum over ALL subtasks (done ones included); the parent's
  // own estimate only fills in while no subtask has one yet
  const sum = children.reduce((acc, c) => acc + (c.estimate_min ?? 0), 0)
  const childDues = children.map((c) => c.due_date).filter((d): d is string => d !== null)
  return {
    estimateMin: sum > 0 ? sum : task.estimate_min,
    dueDate: task.due_date ?? (childDues.length > 0 ? childDues.sort().at(-1)! : null),
  }
}

/** Split an estimate across N days, snapped up to 15-minute steps. */
export function splitDuration(estimateMin: number | null, dayCount: number): number {
  const total = estimateMin ?? 60
  return Math.max(15, Math.ceil(total / Math.max(1, dayCount) / 15) * 15)
}

/** First gap of `duration` minutes between existing blocks of one day. */
export function findFreeStart(
  dayBlocks: ScheduleBlock[],
  durationMin: number,
  dayStartMin: number,
  dayEndMin: number,
): number {
  const sorted = [...dayBlocks].sort((a, b) => a.start_min - b.start_min)
  let cursor = dayStartMin
  for (const b of sorted) {
    if (b.start_min - cursor >= durationMin) break
    cursor = Math.ceil(Math.max(cursor, b.start_min + b.duration_min) / 15) * 15
  }
  return clamp(cursor, 0, Math.max(dayStartMin, dayEndMin - durationMin))
}

/** Finished vs planned sessions of one task: [done, total] blocks. */
export function sessionCount(blocks: ScheduleBlock[] | undefined): [number, number] {
  if (!blocks || blocks.length === 0) return [0, 0]
  return [blocks.filter((b) => Boolean(b.completed_at)).length, blocks.length]
}

/**
 * Share (0–1) of a task's planned time that is already ticked off, day by day.
 * Null when the task has no plan, so progress falls back to the focus timer.
 */
function sessionShare(blocks: ScheduleBlock[] | undefined): number | null {
  if (!blocks || blocks.length === 0) return null
  const total = blocks.reduce((a, b) => a + b.duration_min, 0)
  if (total === 0) return null
  const done = blocks
    .filter((b) => Boolean(b.completed_at))
    .reduce((a, b) => a + b.duration_min, 0)
  return done / total
}

/**
 * Completion percentage, derived — never typed in by hand.
 * Leaves: finished planned days if the task has a plan, else time worked vs
 * estimate (capped at 99 until marked done).
 * Parents: estimate-weighted share of completed subtasks, with open subtasks
 * contributing whatever they have part-finished.
 */
export function taskProgress(
  task: Task,
  children: Task[],
  blocksByTask?: Map<string, ScheduleBlock[]>,
): number | null {
  if (task.completed_at) return 100
  if (children.length > 0) {
    const weight = (c: Task) => c.estimate_min ?? 30
    const total = children.reduce((a, c) => a + weight(c), 0)
    if (total === 0) return null
    const done = children.filter((c) => c.completed_at).reduce((a, c) => a + weight(c), 0)
    const partial = children
      .filter((c) => !c.completed_at)
      .reduce((a, c) => {
        const bySession = sessionShare(blocksByTask?.get(c.id)) ?? 0
        const byTimer =
          c.estimate_min && c.spent_min > 0 ? c.spent_min / c.estimate_min : 0
        return a + Math.min(0.99, Math.max(bySession, byTimer)) * weight(c)
      }, 0)
    return Math.round(((done + partial) / total) * 100)
  }
  // a planned task measures itself in finished days before it trusts the timer
  const share = sessionShare(blocksByTask?.get(task.id))
  if (share !== null && share > 0) return Math.min(99, Math.round(share * 100))
  if (task.spent_min > 0 && task.estimate_min) {
    return Math.min(99, Math.round((task.spent_min / task.estimate_min) * 100))
  }
  return null
}

/**
 * Which days of a task's current plan are already ticked off. Re-saving a
 * schedule rebuilds its blocks, and a day that survives the edit keeps the
 * work you already logged against it.
 */
export async function finishedDays(taskId: string): Promise<Record<string, string | null>> {
  const { data } = await supabase
    .from('schedule_blocks')
    .select('day, completed_at')
    .eq('task_id', taskId)
    .not('completed_at', 'is', null)
  const map: Record<string, string | null> = {}
  for (const b of (data ?? []) as Pick<ScheduleBlock, 'day' | 'completed_at'>[]) {
    map[b.day] = b.completed_at
  }
  return map
}

export interface ResolvedPlan {
  entries: { day: string; start_min: number }[]
  duration_min: number
}

/**
 * Turn a plan request into concrete per-day slots. Auto mode derives the
 * per-day duration from the task's estimate and drops each day's block into
 * the first free gap around what is already scheduled.
 */
export async function resolvePlan(
  task: Task,
  plan: PlanFields,
  dayStartMin: number,
  dayEndMin: number,
): Promise<ResolvedPlan> {
  const duration = plan.auto
    ? splitDuration(task.estimate_min, plan.days.length)
    : plan.duration_min

  if (!plan.auto) {
    return {
      entries: plan.days.map((day) => ({ day, start_min: plan.start_min })),
      duration_min: duration,
    }
  }

  const { data } = await supabase
    .from('schedule_blocks')
    .select('*')
    .in('day', plan.days)
    .neq('task_id', task.id)
  const byDay = new Map<string, ScheduleBlock[]>()
  for (const b of (data ?? []) as ScheduleBlock[]) {
    const arr = byDay.get(b.day) ?? []
    arr.push(b)
    byDay.set(b.day, arr)
  }
  return {
    entries: plan.days.map((day) => ({
      day,
      start_min: findFreeStart(byDay.get(day) ?? [], duration, dayStartMin, dayEndMin),
    })),
    duration_min: duration,
  }
}
