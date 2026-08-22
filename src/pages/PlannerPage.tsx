import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { addWeeks } from 'date-fns'
import { useProfile, useProjects, useTasks, useWeekBlocks } from '../hooks/useData'
import { useScheduleMutations, useTaskMutations } from '../hooks/useMutations'
import {
  PX_PER_MIN,
  clamp,
  fromDateStr,
  snap15,
  toDateStr,
  todayStr,
  weekDays,
  weekStartStr,
} from '../lib/time'
import type { ScheduleBlock, Task } from '../lib/types'
import { WeekStrip } from '../components/planner/WeekStrip'
import { DayTimeline } from '../components/planner/DayTimeline'
import { DueStrip } from '../components/planner/DueStrip'
import { PlanScheduleSheet } from '../components/sheets/PlanScheduleSheet'
import { TimeBudgetPanel } from '../components/budget/TimeBudgetPanel'
import { ProjectBoard } from '../components/projects/ProjectBoard'
import { BlockDetailsSheet } from '../components/sheets/BlockDetailsSheet'
import { ConfirmSheet } from '../components/sheets/ConfirmSheet'
import type { ConfirmRequest } from '../components/sheets/ConfirmSheet'

type DragData =
  | { type: 'task'; task: Task }
  | { type: 'block'; block: ScheduleBlock }

export function PlannerPage() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(todayStr)
  const weekStart = weekStartStr(anchor)

  const { data: blocks } = useWeekBlocks(weekStart)
  const { data: tasks } = useTasks()
  const { data: projects } = useProjects()
  const { data: profile } = useProfile()
  const { createPlan, moveBlock, resizeBlock, deletePlan, deleteBlocksForTask } =
    useScheduleMutations()
  const { setCompleted } = useTaskMutations()

  const [detailBlockId, setDetailBlockId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [planTask, setPlanTask] = useState<Task | null>(null)

  const dayStartMin = profile?.day_start_min ?? 360
  const dayEndMin = profile?.day_end_min ?? 1380
  const capacityMin = profile?.day_capacity_min ?? 480

  const taskById = useMemo(() => new Map((tasks ?? []).map((t) => [t.id, t])), [tasks])
  const projectById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects],
  )
  const parentIds = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks ?? []) if (t.parent_id) s.add(t.parent_id)
    return s
  }, [tasks])

  // Tasks that have subtasks never appear as blocks (they are headers, not work).
  const visibleBlocks = useMemo(
    () => (blocks ?? []).filter((b) => !parentIds.has(b.task_id)),
    [blocks, parentIds],
  )
  const dayBlocks = visibleBlocks.filter((b) => b.day === selectedDay)

  const weekDayStrs = weekDays(anchor).map(toDateStr)

  // tasks due on the selected day; when viewing today, overdue ones surface too
  const dueTasks = useMemo(() => {
    const today = todayStr()
    return (tasks ?? [])
      .filter(
        (t) =>
          !t.completed_at &&
          t.due_date !== null &&
          (t.due_date === selectedDay || (selectedDay === today && t.due_date < today)),
      )
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  }, [tasks, selectedDay])
  const overloadedDays = useMemo(() => {
    const sums = new Map<string, number>()
    for (const b of visibleBlocks) sums.set(b.day, (sums.get(b.day) ?? 0) + b.duration_min)
    return new Set([...sums.entries()].filter(([, m]) => m > capacityMin).map(([d]) => d))
  }, [visibleBlocks, capacityMin])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const shiftWeek = (delta: number) => {
    setAnchor((a) => addWeeks(a, delta))
    setSelectedDay((d) => toDateStr(addWeeks(fromDateStr(d), delta)))
  }

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined
    if (!data) return
    setDragLabel(data.type === 'task' ? data.task.title : taskById.get(data.block.task_id)?.title ?? '')
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragLabel(null)
    const overId = e.over?.id
    const data = e.active.data.current as DragData | undefined
    if (!overId || !data || typeof overId !== 'string') return

    if (data.type === 'block') {
      const b = data.block
      if (overId === 'timeline') {
        const start = clamp(
          snap15(b.start_min + e.delta.y / PX_PER_MIN),
          dayStartMin,
          Math.max(dayStartMin, dayEndMin - b.duration_min),
        )
        moveBlock.mutate({ id: b.id, day: b.day, start_min: start, weekStart })
      } else if (overId.startsWith('day:')) {
        moveBlock.mutate({ id: b.id, day: overId.slice(4), start_min: b.start_min, weekStart })
      }
      return
    }

    // dragging a leaf task from the project board
    const t = data.task
    const duration = t.estimate_min ?? 30
    if (overId === 'timeline') {
      const col = document.getElementById('timeline-col')
      const translated = e.active.rect.current.translated
      if (!col || !translated) return
      const y = translated.top - col.getBoundingClientRect().top
      const start = clamp(
        dayStartMin + snap15(y / PX_PER_MIN),
        dayStartMin,
        Math.max(dayStartMin, dayEndMin - duration),
      )
      createPlan.mutate({
        task_id: t.id,
        days: [selectedDay],
        start_min: start,
        duration_min: duration,
      })
    } else if (overId.startsWith('day:')) {
      createPlan.mutate({
        task_id: t.id,
        days: [overId.slice(4)],
        start_min: dayStartMin,
        duration_min: duration,
      })
    }
  }

  const detailBlock = detailBlockId
    ? (blocks ?? []).find((b) => b.id === detailBlockId) ?? null
    : null
  const detailTask = detailBlock ? taskById.get(detailBlock.task_id) : undefined

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="planner">
        <aside className="planner__board">
          <h2 className="pane-title">Projects</h2>
          <ProjectBoard draggable />
        </aside>
        <div className="planner__main">
          <WeekStrip
            anchor={anchor}
            selectedDay={selectedDay}
            overloadedDays={overloadedDays}
            onSelect={setSelectedDay}
            onShiftWeek={shiftWeek}
            onToday={() => {
              setAnchor(new Date())
              setSelectedDay(todayStr())
            }}
          />
          <TimeBudgetPanel
            selectedDay={selectedDay}
            weekDayStrs={weekDayStrs}
            blocks={visibleBlocks}
            tasks={tasks}
            dayCapacityMin={capacityMin}
          />
          <DueStrip
            tasks={dueTasks}
            projectById={projectById}
            hasChildren={(id) => parentIds.has(id)}
            onPlan={setPlanTask}
          />
          <DayTimeline
            day={selectedDay}
            blocks={dayBlocks}
            taskById={taskById}
            projectById={projectById}
            dayStartMin={dayStartMin}
            dayEndMin={dayEndMin}
            onBlockTap={(b) => setDetailBlockId(b.id)}
          />
        </div>
      </div>

      <DragOverlay>
        {dragLabel !== null && <div className="drag-ghost">{dragLabel}</div>}
      </DragOverlay>

      {detailBlock && (
        <BlockDetailsSheet
          block={detailBlock}
          task={detailTask}
          parentTask={
            detailTask?.parent_id ? taskById.get(detailTask.parent_id) : undefined
          }
          project={detailTask ? projectById.get(detailTask.project_id) : undefined}
          planDayCount={
            (blocks ?? []).filter((b) => b.plan_group_id === detailBlock.plan_group_id)
              .length
          }
          onClose={() => setDetailBlockId(null)}
          onResize={(m) => resizeBlock.mutate({ id: detailBlock.id, duration_min: m })}
          onToggleDone={() => {
            if (detailTask)
              setCompleted.mutate({
                id: detailTask.id,
                completed: !detailTask.completed_at,
              })
          }}
          onDeletePlan={() => {
            const group = detailBlock.plan_group_id
            setDetailBlockId(null)
            setConfirm({
              title: 'Remove from calendar?',
              message: 'The task itself stays in your project — only its planned time is removed.',
              confirmLabel: 'Remove',
              onConfirm: () => deletePlan.mutate(group),
            })
          }}
        />
      )}
      {planTask && (
        <PlanScheduleSheet
          task={planTask}
          onClose={() => setPlanTask(null)}
          onSave={(plan) => {
            void (async () => {
              await deleteBlocksForTask.mutateAsync(planTask.id)
              if (plan.days.length > 0)
                createPlan.mutate({ task_id: planTask.id, ...plan })
            })()
          }}
        />
      )}
      {confirm && <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />}
    </DndContext>
  )
}
