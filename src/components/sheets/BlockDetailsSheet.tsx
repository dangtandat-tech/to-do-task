import { fromDateStr, minToLabel } from '../../lib/time'
import { format } from 'date-fns'
import { QUADRANT_COLOR, QUADRANT_LABEL } from '../../lib/quadrant'
import type { Project, ScheduleBlock, Task } from '../../lib/types'
import { BottomSheet } from './BottomSheet'
import { EstimatePicker } from '../pickers/EstimatePicker'

interface Props {
  block: ScheduleBlock
  task: Task | undefined
  parentTask: Task | undefined
  project: Project | undefined
  planDayCount: number
  onClose: () => void
  onResize: (durationMin: number) => void
  onToggleDone: () => void
  onDeletePlan: () => void
}

export function BlockDetailsSheet({
  block,
  task,
  parentTask,
  project,
  planDayCount,
  onClose,
  onResize,
  onToggleDone,
  onDeletePlan,
}: Props) {
  const done = Boolean(task?.completed_at)
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
            style={{ color: QUADRANT_COLOR[task.quadrant] }}
          >
            {' '}
            · {QUADRANT_LABEL[task.quadrant]}
          </span>
        )}
      </p>
      {planDayCount > 1 && (
        <p className="sheet__hint">Part of a plan spanning {planDayCount} days.</p>
      )}

      <span className="field__label">Duration this day</span>
      <EstimatePicker value={block.duration_min} onChange={(m) => m && onResize(m)} allowNone={false} />

      <div className="sheet-actions">
        <button className="btn btn--danger-ghost" onClick={onDeletePlan}>
          {planDayCount > 1 ? 'Delete plan' : 'Unschedule'}
        </button>
        <button className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
        {task && (
          <button className="btn btn--primary" onClick={onToggleDone}>
            {done ? 'Reopen' : 'Mark done'}
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
