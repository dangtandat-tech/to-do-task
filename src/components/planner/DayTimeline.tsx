import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { format } from 'date-fns'
import { QUADRANT_COLOR } from '../../lib/quadrant'
import {
  PX_PER_MIN,
  fromDateStr,
  layoutDayBlocks,
  minToLabel,
  nowMin,
  todayStr,
} from '../../lib/time'
import type { LaidOutBlock } from '../../lib/time'
import type { Project, ScheduleBlock, Task } from '../../lib/types'

type PositionedBlock = LaidOutBlock & { top: number; height: number }

function NowLine({ min, dayStartMin }: { min: number; dayStartMin: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'center' })
  }, [])
  if (min < dayStartMin) return null
  return (
    <div
      ref={ref}
      className="now-line"
      style={{ top: (min - dayStartMin) * PX_PER_MIN }}
    />
  )
}

function BlockView({
  block,
  task,
  parentTask,
  project,
  isNow,
  onTap,
}: {
  block: PositionedBlock
  task: Task | undefined
  parentTask: Task | undefined
  project: Project | undefined
  isNow: boolean
  onTap: (b: ScheduleBlock) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { type: 'block', block },
  })
  const done = Boolean(task?.completed_at)
  const width = 100 / block.laneCount
  const q = task?.quadrant ?? 'neither'
  const due = task?.due_date ?? null
  const dueHot = due !== null && due <= todayStr()
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={[
        'block',
        done ? 'block--done' : '',
        isDragging ? 'block--lifted' : '',
        isNow && !done ? 'block--now' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        top: block.top,
        height: block.height,
        left: `calc(${block.lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        borderLeftColor: QUADRANT_COLOR[q],
      }}
      onClick={() => onTap(block)}
    >
      {project && <span className="block__proj">{project.name}</span>}
      {parentTask && <span className="block__parent">{parentTask.title}</span>}
      <span className="block__title">{task?.title ?? '—'}</span>
      <span className="block__time">
        {minToLabel(block.start_min)}–{minToLabel(block.start_min + block.duration_min)}
        {isNow && !done && <span className="block__nowtag"> · Now</span>}
        {due && !done && (
          <span className={`block__duetag${dueHot ? ' block__duetag--hot' : ''}`}>
            {' '}
            · Due {format(fromDateStr(due), 'd MMM')}
          </span>
        )}
      </span>
    </div>
  )
}

interface Props {
  day: string
  blocks: ScheduleBlock[]
  taskById: Map<string, Task>
  projectById: Map<string, Project>
  dayStartMin: number
  dayEndMin: number
  onBlockTap: (b: ScheduleBlock) => void
}

export function DayTimeline({
  day,
  blocks,
  taskById,
  projectById,
  dayStartMin,
  dayEndMin,
  onBlockTap,
}: Props) {
  const { setNodeRef } = useDroppable({ id: 'timeline' })
  const [minNow, setMinNow] = useState(nowMin())
  useEffect(() => {
    const t = setInterval(() => setMinNow(nowMin()), 60_000)
    return () => clearInterval(t)
  }, [])

  const laid = layoutDayBlocks(blocks).map((b) => ({
    ...b,
    top: (b.start_min - dayStartMin) * PX_PER_MIN,
    height: b.duration_min * PX_PER_MIN,
  }))
  const hours: number[] = []
  for (let m = dayStartMin; m <= dayEndMin; m += 60) hours.push(m)
  const height = (dayEndMin - dayStartMin) * PX_PER_MIN
  const isToday = day === todayStr()

  return (
    <div className="timeline">
      <div className="timeline__gutter" style={{ height }}>
        {hours.map((m) => (
          <span
            key={m}
            className="hour-label"
            style={{ top: (m - dayStartMin) * PX_PER_MIN }}
          >
            {minToLabel(m)}
          </span>
        ))}
      </div>
      <div
        id="timeline-col"
        ref={setNodeRef}
        className="timeline__col"
        style={{ height, '--hour-px': `${60 * PX_PER_MIN}px` } as CSSProperties}
      >
        {isToday && <NowLine min={minNow} dayStartMin={dayStartMin} />}
        {laid.length === 0 && (
          <p className="timeline__empty">
            Nothing planned this day.
            <br />
            Plan a task from your projects.
          </p>
        )}
        {laid.map((b) => {
          const task = taskById.get(b.task_id)
          const parentTask = task?.parent_id ? taskById.get(task.parent_id) : undefined
          const project = task ? projectById.get(task.project_id) : undefined
          const isNow =
            isToday && minNow >= b.start_min && minNow < b.start_min + b.duration_min
          return (
            <BlockView
              key={b.id}
              block={b}
              task={task}
              parentTask={parentTask}
              project={project}
              isNow={isNow}
              onTap={onBlockTap}
            />
          )
        })}
      </div>
    </div>
  )
}
