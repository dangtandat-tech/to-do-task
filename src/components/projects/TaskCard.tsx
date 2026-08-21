import type { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { format } from 'date-fns'
import { QUADRANT_COLOR } from '../../lib/quadrant'
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

export function TaskMeta({ task }: { task: Task }) {
  const overdue =
    !task.completed_at && task.due_date !== null && task.due_date < todayStr()
  return (
    <span className="task-meta">
      <span className="quad-dot" style={{ background: QUADRANT_COLOR[task.quadrant] }} />
      {task.estimate_min !== null && <span>{durationLabel(task.estimate_min)}</span>}
      {task.due_date && (
        <span className={overdue ? 'task-meta__due--overdue' : ''}>
          {format(fromDateStr(task.due_date), 'd MMM')}
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
  onToggleDone: () => void
  onEdit: () => void
  onPlan?: () => void
  onAddSub?: () => void
  draggable: boolean
}

export function TaskRow({
  task,
  isSub,
  childProgress,
  canComplete,
  onToggleDone,
  onEdit,
  onPlan,
  onAddSub,
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
        {task.title}
        {childProgress && (
          <span className="task-row__count">
            {childProgress[0]}/{childProgress[1]}
          </span>
        )}
      </button>
      <TaskMeta task={task} />
      <span className="task-row__actions">
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
