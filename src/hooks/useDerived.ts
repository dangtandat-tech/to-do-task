import { useMemo } from 'react'
import { QUADRANTS } from '../lib/quadrant'
import type { Quadrant, ScheduleBlock, Task } from '../lib/types'

export interface TaskNode {
  task: Task
  children: Task[]
}

/** Tasks grouped per project as top-level nodes with their subtasks attached. */
export function useTaskTree(tasks: Task[] | undefined) {
  return useMemo(() => {
    const byProject = new Map<string, TaskNode[]>()
    if (!tasks) return byProject
    const childrenOf = new Map<string, Task[]>()
    for (const t of tasks) {
      if (t.parent_id) {
        const arr = childrenOf.get(t.parent_id) ?? []
        arr.push(t)
        childrenOf.set(t.parent_id, arr)
      }
    }
    for (const t of tasks) {
      if (t.parent_id) continue
      const arr = byProject.get(t.project_id) ?? []
      arr.push({ task: t, children: childrenOf.get(t.id) ?? [] })
      byProject.set(t.project_id, arr)
    }
    return byProject
  }, [tasks])
}

export interface BudgetRow {
  quadrant: Quadrant
  minutes: number
}

export interface Budget {
  rows: BudgetRow[]
  totalMin: number
  capacityMin: number
  overBy: number
  /** estimates of tasks due on the day(s) that have no schedule blocks at all */
  unplannedDueMin: number
}

/**
 * Sum planned minutes per Eisenhower quadrant for a set of days,
 * compared against capacity. Pure derivation from cached queries.
 */
export function useTimeBudget(
  days: string[],
  blocks: ScheduleBlock[] | undefined,
  tasks: Task[] | undefined,
  dayCapacityMin: number,
): Budget {
  return useMemo(() => {
    const daySet = new Set(days)
    const taskById = new Map((tasks ?? []).map((t) => [t.id, t]))
    const sums = new Map<Quadrant, number>()
    const scheduledTaskIds = new Set<string>()
    let totalMin = 0

    for (const b of blocks ?? []) {
      scheduledTaskIds.add(b.task_id)
      if (!daySet.has(b.day)) continue
      const q = taskById.get(b.task_id)?.quadrant ?? 'neither'
      sums.set(q, (sums.get(q) ?? 0) + b.duration_min)
      totalMin += b.duration_min
    }

    let unplannedDueMin = 0
    for (const t of tasks ?? []) {
      if (t.completed_at || !t.due_date || !daySet.has(t.due_date)) continue
      // parents with children are planned via their subtasks
      const hasChildren = (tasks ?? []).some((c) => c.parent_id === t.id)
      if (hasChildren) continue
      if (!scheduledTaskIds.has(t.id)) unplannedDueMin += t.estimate_min ?? 0
    }

    const capacityMin = dayCapacityMin * days.length
    return {
      rows: QUADRANTS.map((q) => ({ quadrant: q, minutes: sums.get(q) ?? 0 })),
      totalMin,
      capacityMin,
      overBy: Math.max(0, totalMin - capacityMin),
      unplannedDueMin,
    }
  }, [days, blocks, tasks, dayCapacityMin])
}
