import { fromDateStr, minToLabel } from '../../lib/time'
import { format } from 'date-fns'
import { QUADRANT_COLOR, QUADRANT_LABEL } from '../../lib/quadrant'
import { effectiveQuadrant, isEscalated } from '../../lib/smart'
import type { Project, ScheduleBlock, Task } from '../../lib/types'
import { BottomSheet } from './BottomSheet'
import { EstimatePicker } from '../pickers/EstimatePicker'

interface Props {
  block: ScheduleBlock
  task: Task | undefined
  parentTask: Task | undefined
  project: Project | undefined
  /** days in this plan group — what "Delete plan" would remove */
  groupDayCount: number
  /** the task's whole schedule: planned days and how many are ticked off */
  taskDayCount: number
  taskDoneCount: number
  onClose: () => void
  onResize: (durationMin: number) => void
  /** finishes THIS day only; the task closes when the last day is ticked */
  onToggleDay: () => void
  /** finishes the whole task, every remaining day with it */
  onFinishTask: () => void
  onDeletePlan: () => void
  onStartTimer?: () => void
}

export function BlockDetailsSheet({
  block,
  task,
  parentTask,
  project,
  groupDayCount,
  taskDayCount,
  taskDoneCount,
  onClose,
  onResize,
  onToggleDay,
  onFinishTask,
  onDeletePlan,
  onStartTimer,
}: Props) {
  const dayDone = Boolean(block.completed_at)
  const taskDone = Boolean(task?.completed_at)
  const multiDay = taskDayCount > 1
  // the last open day of a plan: ticking it finishes the task anyway
  const lastOpenDay = multiDay && !dayDone && taskDoneCount === taskDayCount - 1
  return (
    <BottomSheet title={task?.title ?? 'Scheduled work'} onClose={onClose}>
      <p className="sheet__crumbs">
        {project?.name}
        {parentTask ? ` › ${parentTask.title}` : ''}
      </p>
      <p className="sheet__text">
        {format(fromDateStr(block.day), 'EEEE, d MMMM')} · {minToLabel(block.start_min)}–
        {minToLabel(block.start_min + block.duration_min)}
        {task && (
          <span
            className="quad-tag"
            style={{ color: QUADRANT_COLOR[effectiveQuadrant(task.quadrant, task.due_date)] }}
          >
            {' '}
            · {QUADRANT_LABEL[effectiveQuadrant(task.quadrant, task.due_date)]}
            {isEscalated(task.quadrant, task.due_date) && !task.completed_at && (
              <span title="Auto-raised: deadline near"> ↑</span>
            )}
          </span>
        )}
      </p>
      {multiDay && (
        <p className="sheet__hint">
          Planned over {taskDayCount} days ·{' '}
          <strong>
            {taskDoneCount}/{taskDayCount} days done
          </strong>
          {lastOpenDay && ' — ticking this one finishes the task.'}
        </p>
      )}

      <span className="field__label">Duration this day</span>
      <EstimatePicker value={block.duration_min} onChange={(m) => m && onResize(m)} allowNone={false} />

      <div className="sheet-actions">
        <button className="btn btn--danger-ghost" onClick={onDeletePlan}>
          {groupDayCount > 1 ? 'Delete plan' : 'Unschedule'}
        </button>
        <button className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
        {task && !dayDone && onStartTimer && (
          <button className="btn btn--primary" onClick={onStartTimer}>
            ▶ Start
          </button>
        )}
        {task && multiDay && !taskDone && !dayDone && (
          <button className="btn btn--ghost" onClick={onFinishTask}>
            Finish whole task
          </button>
        )}
        {task && (
          <button
            className={`btn ${dayDone || !onStartTimer ? 'btn--primary' : 'btn--ghost'}`}
            onClick={onToggleDay}
          >
            {dayDone
              ? multiDay
                ? 'Reopen this day'
                : 'Reopen'
              : multiDay
                ? 'This day done'
                : 'Mark done'}
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
