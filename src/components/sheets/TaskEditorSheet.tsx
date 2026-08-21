import { useState } from 'react'
import type { Quadrant, Task } from '../../lib/types'
import type { TaskInput } from '../../hooks/useMutations'
import { BottomSheet } from './BottomSheet'
import { QuadrantPicker } from '../pickers/QuadrantPicker'
import { EstimatePicker } from '../pickers/EstimatePicker'

export interface TaskEditorRequest {
  mode: 'create' | 'edit'
  projectId: string
  parentId: string | null
  task?: Task
}

interface Props {
  request: TaskEditorRequest
  onClose: () => void
  onSave: (input: TaskInput, existingId: string | null) => void
  onDelete?: (task: Task) => void
}

export function TaskEditorSheet({ request, onClose, onSave, onDelete }: Props) {
  const t = request.task
  const [title, setTitle] = useState(t?.title ?? '')
  const [quadrant, setQuadrant] = useState<Quadrant>(t?.quadrant ?? 'neither')
  const [estimate, setEstimate] = useState<number | null>(t?.estimate_min ?? 30)
  const [dueDate, setDueDate] = useState<string>(t?.due_date ?? '')

  const isSub = request.parentId !== null
  const heading =
    request.mode === 'edit'
      ? isSub
        ? 'Edit subtask'
        : 'Edit task'
      : isSub
        ? 'New subtask'
        : 'New task'

  const save = () => {
    if (!title.trim()) return
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
        <span className="field__label">Due date</span>
        <input
          type="date"
          className="field__input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </label>

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
