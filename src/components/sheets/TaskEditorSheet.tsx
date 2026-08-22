import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import type { PlanFields, Quadrant, ScheduleBlock, Task } from '../../lib/types'
import type { TaskInput } from '../../hooks/useMutations'
import { durationLabel, fromDateStr, minToLabel } from '../../lib/time'
import { BottomSheet } from './BottomSheet'
import { QuadrantPicker } from '../pickers/QuadrantPicker'
import { EstimatePicker } from '../pickers/EstimatePicker'
import { SchedulePicker } from '../pickers/SchedulePicker'
import { Icon } from '../Icon'

export interface TaskEditorRequest {
  mode: 'create' | 'edit'
  projectId: string
  parentId: string | null
  task?: Task
  /** false for tasks that have subtasks — their schedule lives on the subtasks */
  canPlan?: boolean
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

  // Work schedule: loaded from the task's existing blocks; collapsed behind
  // a summary row so the sheet stays short. Any change replaces the schedule.
  const [planDays, setPlanDays] = useState<Set<string>>(() => new Set())
  const [planStart, setPlanStart] = useState(540)
  const [planDuration, setPlanDuration] = useState<number | null>(null)
  const [planLoaded, setPlanLoaded] = useState(!isEdit)
  const [planDirty, setPlanDirty] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)

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
    if (canPlan && planDirty) {
      plan = { days: [...planDays].sort(), start_min: planStart, duration_min: duration }
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

  const sortedDays = [...planDays].sort()
  const scheduleSummary =
    sortedDays.length === 0
      ? 'Not scheduled'
      : `${
          sortedDays.length === 1
            ? format(fromDateStr(sortedDays[0]), 'EEE d MMM')
            : `${sortedDays.length} days from ${format(fromDateStr(sortedDays[0]), 'd MMM')}`
        } · ${minToLabel(planStart)} · ${durationLabel(planDuration ?? estimate ?? 60)}`

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
        <span className="field__label">Deadline — when it must be finished</span>
        <input
          type="date"
          className="field__input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </label>

      {canPlan && (
        <>
          <button
            type="button"
            className={`summary-row${planOpen ? ' summary-row--open' : ''}`}
            disabled={!planLoaded}
            onClick={() => setPlanOpen((o) => !o)}
          >
            <span className="summary-row__label">Work days</span>
            <span className="summary-row__value">
              {planLoaded ? scheduleSummary : '…'}
            </span>
            <Icon name="chevronRight" size={15} />
          </button>
          {planOpen && planLoaded && (
            <>
              <SchedulePicker
                days={planDays}
                startMin={planStart}
                duration={planDuration ?? estimate ?? 60}
                onToggleDay={togglePlanDay}
                onStart={(v) => {
                  setPlanDirty(true)
                  setPlanStart(v)
                }}
                onDuration={(v) => {
                  setPlanDirty(true)
                  setPlanDuration(v)
                }}
                disablePast={!isEdit}
                initialAnchor={sortedDays[0] ? fromDateStr(sortedDays[0]) : undefined}
              />
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
