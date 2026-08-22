import { useState } from 'react'
import type { Quadrant, Task } from '../../lib/types'
import type { TaskInput } from '../../hooks/useMutations'
import { durationLabel } from '../../lib/time'
import { BottomSheet } from './BottomSheet'
import { QuadrantPicker } from '../pickers/QuadrantPicker'
import { EstimatePicker } from '../pickers/EstimatePicker'
import { MiniWeekPicker } from '../pickers/MiniWeekPicker'
import { TimeStepper } from '../pickers/TimeStepper'

export interface TaskEditorRequest {
  mode: 'create' | 'edit'
  projectId: string
  parentId: string | null
  task?: Task
}

export interface PlanFields {
  days: string[]
  start_min: number
  duration_min: number
}

interface Props {
  request: TaskEditorRequest
  onClose: () => void
  onSave: (input: TaskInput, existingId: string | null, plan: PlanFields | null) => void
  onDelete?: (task: Task) => void
}

export function TaskEditorSheet({ request, onClose, onSave, onDelete }: Props) {
  const t = request.task
  const [title, setTitle] = useState(t?.title ?? '')
  const [quadrant, setQuadrant] = useState<Quadrant>(t?.quadrant ?? 'neither')
  const [estimate, setEstimate] = useState<number | null>(t?.estimate_min ?? 30)
  const [dueDate, setDueDate] = useState<string>(t?.due_date ?? '')

  // optional "schedule while creating" — work days are independent of the due date
  const [planDays, setPlanDays] = useState<Set<string>>(() => new Set())
  const [planStart, setPlanStart] = useState(540)
  const [planDuration, setPlanDuration] = useState<number | null>(null)

  const isSub = request.parentId !== null
  const heading =
    request.mode === 'edit'
      ? isSub
        ? 'Edit subtask'
        : 'Edit task'
      : isSub
        ? 'New subtask'
        : 'New task'

  const togglePlanDay = (d: string) => {
    setPlanDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const save = () => {
    if (!title.trim()) return
    const duration = planDuration ?? estimate ?? 60
    onSave(
      {
        project_id: request.projectId,
        parent_id: request.parentId,
        title: title.trim(),
        quadrant,
        due_date: dueDate || null,
        estimate_min: estimate,
      },
      t?.id ?? null,
      request.mode === 'create' && planDays.size > 0
        ? { days: [...planDays].sort(), start_min: planStart, duration_min: duration }
        : null,
    )
    onClose()
  }

  return (
    <BottomSheet title={heading} onClose={onClose}>
      <label className="field">
        <span className="field__label">Title</span>
        <input
          className="field__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isSub ? 'Subtask title' : 'Task title'}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
        />
      </label>

      <span className="field__label">Priority</span>
      <QuadrantPicker value={quadrant} onChange={setQuadrant} />

      <span className="field__label">Estimated time</span>
      <EstimatePicker value={estimate} onChange={setEstimate} />

      <label className="field">
        <span className="field__label">Due date (deadline)</span>
        <input
          type="date"
          className="field__input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </label>

      {request.mode === 'create' && (
        <>
          <span className="field__label">
            Work days — when you plan to do it (optional, can differ from the deadline)
          </span>
          <MiniWeekPicker selected={planDays} onToggle={togglePlanDay} />
          {planDays.size > 0 && (
            <>
              <span className="field__label">Start time</span>
              <TimeStepper value={planStart} onChange={setPlanStart} />
              <span className="field__label">
                {planDays.size > 1 ? 'Duration per day' : 'Duration'}
              </span>
              <EstimatePicker
                value={planDuration ?? estimate ?? 60}
                onChange={setPlanDuration}
                allowNone={false}
              />
              {planDays.size > 1 && (
                <p className="sheet__hint">
                  One plan across {planDays.size} days —{' '}
                  {durationLabel((planDuration ?? estimate ?? 60) * planDays.size)} in total.
                </p>
              )}
            </>
          )}
        </>
      )}

      <div className="sheet-actions">
        {request.mode === 'edit' && t && onDelete && (
          <button
            className="btn btn--danger-ghost"
            onClick={() => {
              onDelete(t)
              onClose()
            }}
          >
            Delete
          </button>
        )}
        <button className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn--primary" disabled={!title.trim()} onClick={save}>
          Save
        </button>
      </div>
    </BottomSheet>
  )
}
