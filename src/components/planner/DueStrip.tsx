import { format } from 'date-fns'
import { fromDateStr, todayStr } from '../../lib/time'
import type { Project, Task } from '../../lib/types'

interface Props {
  /** incomplete tasks due on the selected day (plus overdue ones when viewing today) */
  tasks: Task[]
  projectById: Map<string, Project>
  /** tasks with subtasks are shown but not plannable; leaves open the plan sheet */
  hasChildren: (taskId: string) => boolean
  onPlan: (task: Task) => void
}

export function DueStrip({ tasks, projectById, hasChildren, onPlan }: Props) {
  if (tasks.length === 0) return null
  return (
    <div className="due-strip">
      <span className="due-strip__label">Due</span>
      {tasks.map((t) => {
        const overdue = t.due_date !== null && t.due_date < todayStr()
        const leaf = !hasChildren(t.id)
        return (
          <button
            key={t.id}
            type="button"
            className={`due-chip${overdue ? ' due-chip--overdue' : ''}`}
            title={leaf ? 'Tap to plan work time' : 'Plan its subtasks instead'}
            onClick={() => leaf && onPlan(t)}
          >
            <span
              className="quad-dot"
              style={{ background: projectById.get(t.project_id)?.color ?? '#7a7469' }}
            />
            {t.title}
            {t.due_date && (
              <span className="due-chip__date">
                {overdue ? `since ${format(fromDateStr(t.due_date), 'd MMM')}` : 'today'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
