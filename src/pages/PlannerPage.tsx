import { useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { addWeeks } from 'date-fns'
import {
  useAllBlocks,
  useProfile,
  useProjects,
  useTasks,
  useWeekBlocks,
} from '../hooks/useData'
import { finishedDays, resolvePlan } from '../lib/smart'
import { useScheduleMutations, useTaskMutations } from '../hooks/useMutations'
import {
  clamp,
  fromDateStr,
  snap15,
  toDateStr,
  todayStr,
  weekDays,
  weekStartStr,
} from '../lib/time'
import { useTimer } from '../context/TimerContext'
import { useShowCompleted } from '../hooks/useShowCompleted'
import { Icon } from '../components/Icon'
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

// zoom steps for the timeline scale (pixels per minute)
const ZOOM_LEVELS = [0.8, 1.2, 1.8, 2.6]

function loadZoom(): number {
  try {
    const v = Number(localStorage.getItem('atelier-zoom'))
    return ZOOM_LEVELS.includes(v) ? v : 1.2
  } catch {
    return 1.2
  }
}

const BOARD_MIN_W = 280
const BOARD_MAX_W = 720

function loadBoardWidth(): number {
  try {
    const v = Number(localStorage.getItem('atelier-board-w'))
    return v >= BOARD_MIN_W && v <= BOARD_MAX_W ? v : 360
  } catch {
    return 360
  }
}

export function PlannerPage() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(todayStr)
  const weekStart = weekStartStr(anchor)

  const { data: blocks } = useWeekBlocks(weekStart)
  // the detail sheet counts a task's days across the whole plan, not this week
  const { data: allBlocks } = useAllBlocks()
  const { data: tasks } = useTasks()
  const { data: projects } = useProjects()
  const { data: profile } = useProfile()
  const {
    createPlan,
    moveBlock,
    resizeBlock,
    setBlockCompleted,
    deletePlan,
    deleteBlocksForTask,
  } = useScheduleMutations()
  const { setCompleted } = useTaskMutations()

  const [detailBlockId, setDetailBlockId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [planTask, setPlanTask] = useState<Task | null>(null)
  const [pxPerMin, setPxPerMin] = useState(loadZoom)
  const [boardWidth, setBoardWidth] = useState(loadBoardWidth)
  const [showCompleted, setShowCompleted] = useShowCompleted()
  const timer = useTimer()

  // drag the projects pane's right edge to resize it (desktop)
  const startBoardResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = boardWidth
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    const width = (ev: PointerEvent) =>
      clamp(startW + ev.clientX - startX, BOARD_MIN_W, BOARD_MAX_W)
    const onMove = (ev: PointerEvent) => setBoardWidth(width(ev))
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      try {
        localStorage.setItem('atelier-board-w', String(width(ev)))
      } catch {
        /* per-device preference only */
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const zoom = (dir: 1 | -1) => {
    const i = clamp(ZOOM_LEVELS.indexOf(pxPerMin) + dir, 0, ZOOM_LEVELS.length - 1)
    const v = ZOOM_LEVELS[i]
    setPxPerMin(v)
    try {
      localStorage.setItem('atelier-zoom', String(v))
    } catch {
      /* per-device preference only */
    }
  }

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
  const allDayBlocks = visibleBlocks.filter((b) => b.day === selectedDay)
  // completed work still counts against the day's budget — it only leaves the
  // timeline, so the hidden count is shown next to the zoom controls
  const dayBlocks = showCompleted
    ? allDayBlocks
    : allDayBlocks.filter((b) => !b.completed_at)
  const hiddenDoneCount = allDayBlocks.length - dayBlocks.length

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
          snap15(b.start_min + e.delta.y / pxPerMin),
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
        dayStartMin + snap15(y / pxPerMin),
        dayStartMin,
        Math.max(dayStartMin, dayEndMin - duration),
      )
      createPlan.mutate({
        task_id: t.id,
        entries: [{ day: selectedDay, start_min: start }],
        duration_min: duration,
      })
    } else if (overId.startsWith('day:')) {
      // dropping on a day cell schedules into that day's first free slot
      void resolvePlan(
        t,
        { days: [overId.slice(4)], auto: true, start_min: dayStartMin, duration_min: duration },
        dayStartMin,
        dayEndMin,
      ).then((resolved) => createPlan.mutate({ task_id: t.id, ...resolved }))
    }
  }

  const detailBlock = detailBlockId
    ? (blocks ?? []).find((b) => b.id === detailBlockId) ?? null
    : null
  const detailTask = detailBlock ? taskById.get(detailBlock.task_id) : undefined
  // the task's full schedule, for the sheet's "2/3 days done" line
  const taskDays = detailBlock
    ? (allBlocks ?? []).filter((b) => b.task_id === detailBlock.task_id)
    : []
  const groupDays = detailBlock
    ? (allBlocks ?? []).filter((b) => b.plan_group_id === detailBlock.plan_group_id)
    : []

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="planner">
        <aside className="planner__board" style={{ width: boardWidth }}>
          <h2 className="pane-title">Projects</h2>
          <ProjectBoard draggable />
        </aside>
        <div
          className="pane-resizer"
          title="Drag to resize"
          onPointerDown={startBoardResize}
        />
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
          <div className="timeline-tools">
            <button
              className={`toggle-chip${showCompleted ? ' toggle-chip--on' : ''}`}
              aria-pressed={showCompleted}
              title={showCompleted ? 'Hide completed work' : 'Show completed work'}
              onClick={() => setShowCompleted(!showCompleted)}
            >
              <Icon name={showCompleted ? 'eye' : 'eyeOff'} size={14} />
              {showCompleted ? 'Done shown' : 'Done hidden'}
              {hiddenDoneCount > 0 && (
                <span className="toggle-chip__n">{hiddenDoneCount}</span>
              )}
            </button>
            <div className="timeline-tools__zoom">
              <button
                className="icon-btn"
                aria-label="Zoom out"
                disabled={pxPerMin === ZOOM_LEVELS[0]}
                onClick={() => zoom(-1)}
              >
                <Icon name="zoomOut" size={15} />
              </button>
              <button
                className="icon-btn"
                aria-label="Zoom in"
                disabled={pxPerMin === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                onClick={() => zoom(1)}
              >
                <Icon name="zoomIn" size={15} />
              </button>
            </div>
          </div>
          <DayTimeline
            day={selectedDay}
            blocks={dayBlocks}
            taskById={taskById}
            projectById={projectById}
            dayStartMin={dayStartMin}
            dayEndMin={dayEndMin}
            pxPerMin={pxPerMin}
            hiddenDoneCount={hiddenDoneCount}
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
          groupDayCount={groupDays.length}
          taskDayCount={taskDays.length}
          taskDoneCount={taskDays.filter((b) => Boolean(b.completed_at)).length}
          onClose={() => setDetailBlockId(null)}
          onStartTimer={
            detailTask
              ? () => {
                  timer.start(detailTask.id)
                  setDetailBlockId(null)
                }
              : undefined
          }
          onResize={(m) => resizeBlock.mutate({ id: detailBlock.id, duration_min: m })}
          onToggleDay={() =>
            setBlockCompleted.mutate({
              id: detailBlock.id,
              task_id: detailBlock.task_id,
              completed: !detailBlock.completed_at,
            })
          }
          onFinishTask={() => {
            if (detailTask) {
              setCompleted.mutate({ id: detailTask.id, completed: true })
              setDetailBlockId(null)
            }
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
              const keepDone = await finishedDays(planTask.id)
              await deleteBlocksForTask.mutateAsync(planTask.id)
              if (plan.days.length === 0) return
              const resolved = await resolvePlan(planTask, plan, dayStartMin, dayEndMin)
              createPlan.mutate({ task_id: planTask.id, ...resolved, keepDone })
            })()
          }}
        />
      )}
      {confirm && <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />}
    </DndContext>
  )
}
