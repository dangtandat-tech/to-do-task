import type { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { format } from 'date-fns'
import { QUADRANT_COLOR, QUADRANT_LABEL } from '../../lib/quadrant'
import { effectiveQuadrant, isEscalated } from '../../lib/smart'
import { durationLabel, fromDateStr, todayStr } from '../../lib/time'
import type { Task } from '../../lib/types'
import { Icon } from '../Icon'

function DragWrap({ task, children }: { task: Task; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { type: 'task', task },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`drag-wrap${isDragging ? ' drag-wrap--lifted' : ''}`}
    >
      {children}
    </div>
  )
}

export function TaskMeta({
  task,
  estimateMin,
  dueDate,
}: {
  task: Task
  /** resolved values — parents pass their subtask rollups */
  estimateMin: number | null
  dueDate: string | null
}) {
  const overdue = !task.completed_at && dueDate !== null && dueDate < todayStr()
  const effQ = task.completed_at ? task.quadrant : effectiveQuadrant(task.quadrant, dueDate)
  const escalated = !task.completed_at && isEscalated(task.quadrant, dueDate)
  return (
    <span className="task-meta">
      <span
        className="quad-dot"
        title={QUADRANT_LABEL[effQ] + (escalated ? ' (auto-raised: deadline near)' : '')}
        style={{ background: QUADRANT_COLOR[effQ] }}
      />
      {escalated && (
        <span className="esc-tag" title="Auto-raised: deadline near">
          ↑
        </span>
      )}
      {estimateMin !== null && (
        <span>
          {task.spent_min > 0 && !task.completed_at
            ? `${durationLabel(task.spent_min)} / ${durationLabel(estimateMin)}`
            : durationLabel(estimateMin)}
        </span>
      )}
      {dueDate && (
        <span className={overdue ? 'task-meta__due--overdue' : ''}>
          {format(fromDateStr(dueDate), 'd MMM')}
        </span>
      )}
    </span>
  )
}

interface RowProps {
  task: Task
  isSub: boolean
  /** for parents: fraction of children done, e.g. [2,3]; null for leaves */
  childProgress: [number, number] | null
  canComplete: boolean
  /** resolved meta — parents pass their subtask rollups */
  metaEstimate?: number | null
  metaDue?: string | null
  /** derived completion percentage; null hides the bar */
  progress?: number | null
  onToggleDone: () => void
  onEdit: () => void
  onPlan?: () => void
  onAddSub?: () => void
  /** leaves only: starts the focus timer */
  onStartTimer?: () => void
  draggable: boolean
}

export function TaskRow({
  task,
  isSub,
  childProgress,
  canComplete,
  metaEstimate,
  metaDue,
  progress,
  onToggleDone,
  onEdit,
  onPlan,
  onAddSub,
  onStartTimer,
  draggable,
}: RowProps) {
  const done = Boolean(task.completed_at)
  const body = (
    <div className={`task-row${isSub ? ' task-row--sub' : ''}${done ? ' task-row--done' : ''}`}>
      <button
        className={`check${done ? ' check--on' : ''}`}
        aria-label={done ? 'Reopen' : 'Complete'}
        disabled={!done && !canComplete}
        title={!canComplete && childProgress ? `${childProgress[0]}/${childProgress[1]} subtasks done` : undefined}
        onClick={onToggleDone}
      >
        {done && <Icon name="check" size={13} />}
      </button>
      <button className="task-row__title" onClick={onEdit}>
        <span className="task-row__text">
          {task.title}
          {childProgress && (
            <span className="task-row__count">
              {childProgress[0]}/{childProgress[1]}
            </span>
          )}
          {progress != null && progress > 0 && !done && (
            <span className="task-row__pct">{progress}%</span>
          )}
        </span>
        {progress != null && progress > 0 && !done && (
          <span className="progress-mini">
            <span className="progress-mini__fill" style={{ width: `${progress}%` }} />
          </span>
        )}
      </button>
      <TaskMeta
        task={task}
        estimateMin={metaEstimate !== undefined ? metaEstimate : task.estimate_min}
        dueDate={metaDue !== undefined ? metaDue : task.due_date}
      />
      <span className="task-row__actions">
        {onStartTimer && !done && (
          <button className="icon-btn" aria-label="Start timer" onClick={onStartTimer}>
            <Icon name="play" size={16} />
          </button>
        )}
        {onPlan && !done && (
          <button className="icon-btn" aria-label="Plan on calendar" onClick={onPlan}>
            <Icon name="calendar" size={16} />
          </button>
        )}
        {onAddSub && (
          <button className="icon-btn" aria-label="Add subtask" onClick={onAddSub}>
            <Icon name="plus" size={16} />
          </button>
        )}
      </span>
    </div>
  )
  if (draggable && !done) return <DragWrap task={task}>{body}</DragWrap>
  return body
}
