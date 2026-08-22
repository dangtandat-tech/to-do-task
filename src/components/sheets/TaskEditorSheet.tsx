import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Quadrant, ScheduleBlock, Task } from '../../lib/types'
import type { TaskInput } from '../../hooks/useMutations'
import { durationLabel, fromDateStr } from '../../lib/time'
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
  /** false for tasks that have subtasks — their schedule lives on the subtasks */
  canPlan?: boolean
}

export interface PlanFields {
  /** empty array in edit mode means: remove the schedule entirely */
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
  const isEdit = request.mode === 'edit'
  const canPlan = request.canPlan ?? true

  const [title, setTitle] = useState(t?.title ?? '')
  const [quadrant, setQuadrant] = useState<Quadrant>(t?.quadrant ?? 'neither')
  const [estimate, setEstimate] = useState<number | null>(t?.estimate_min ?? 30)
  const [dueDate, setDueDate] = useState<string>(t?.due_date ?? '')

  // Work days are independent of the due date. In edit mode they start
  // from the task's existing schedule; any change replaces that schedule.
  const [planDays, setPlanDays] = useState<Set<string>>(() => new Set())
  const [planStart, setPlanStart] = useState(540)
  const [planDuration, setPlanDuration] = useState<number | null>(null)
  const [planLoaded, setPlanLoaded] = useState(!isEdit)
  const [planDirty, setPlanDirty] = useState(false)

  const { data: existingBlocks } = useQuery({
    queryKey: ['taskBlocks', t?.id],
    enabled: isEdit && canPlan && Boolean(t),
    queryFn: async (): Promise<ScheduleBlock[]> => {
      const { data, error } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('task_id', t!.id)
        .order('day')
      if (error) throw new Error(error.message)
      return (data ?? []) as ScheduleBlock[]
    },
  })

  useEffect(() => {
    if (planLoaded || existingBlocks === undefined) return
    setPlanDays(new Set(existingBlocks.map((b) => b.day)))
    if (existingBlocks.length > 0) {
      setPlanStart(existingBlocks[0].start_min)
      setPlanDuration(existingBlocks[0].duration_min)
    }
    setPlanLoaded(true)
  }, [existingBlocks, planLoaded])

  const isSub = request.parentId !== null
  const heading = isEdit
    ? isSub
      ? 'Edit subtask'
      : 'Edit task'
    : isSub
      ? 'New subtask'
      : 'New task'

  const togglePlanDay = (d: string) => {
    setPlanDirty(true)
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
    let plan: PlanFields | null = null
    if (canPlan) {
      const fields = { days: [...planDays].sort(), start_min: planStart, duration_min: duration }
      if (!isEdit && planDays.size > 0) plan = fields
      if (isEdit && planDirty) plan = fields
    }
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
      plan,
    )
    onClose()
  }

  const firstPlanned = [...planDays].sort()[0]

  return (
    <BottomSheet title={heading} onClose={onClose}>
      <label className="field">
        <span className="field__label">Title</span>
        <input
          className="field__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isSub ? 'Subtask title' : 'Task title'}
          autoFocus={!isEdit}
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

      {canPlan && planLoaded && (
        <>
          <span className="field__label">
            Work days — when you plan to do it (can differ from the deadline)
          </span>
          <MiniWeekPicker
            selected={planDays}
            onToggle={togglePlanDay}
            disablePast={!isEdit}
            initialAnchor={firstPlanned ? fromDateStr(firstPlanned) : undefined}
          />
          {(planDays.size > 0 || planDirty) && (
            <>
              <span className="field__label">Start time</span>
              <TimeStepper
                value={planStart}
                onChange={(v) => {
                  setPlanDirty(true)
                  setPlanStart(v)
                }}
              />
              <span className="field__label">
                {planDays.size > 1 ? 'Duration per day' : 'Duration'}
              </span>
              <EstimatePicker
                value={planDuration ?? estimate ?? 60}
                onChange={(v) => {
                  setPlanDirty(true)
                  setPlanDuration(v)
                }}
                allowNone={false}
              />
              {planDays.size > 1 && (
                <p className="sheet__hint">
                  One plan across {planDays.size} days —{' '}
                  {durationLabel((planDuration ?? estimate ?? 60) * planDays.size)} in total.
                </p>
              )}
              {isEdit && planDirty && (
                <p className="sheet__hint">
                  {planDays.size === 0
                    ? 'Saving will remove this task from the calendar.'
                    : 'Saving replaces the task’s current schedule.'}
                </p>
              )}
            </>
          )}
        </>
      )}

      <div className="sheet-actions">
        {isEdit && t && onDelete && (
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
