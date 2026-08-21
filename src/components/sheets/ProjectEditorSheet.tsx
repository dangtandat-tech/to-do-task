import { useState } from 'react'
import type { Project } from '../../lib/types'
import { BottomSheet } from './BottomSheet'

const COLORS = ['#8a6d3b', '#8c3b3b', '#3c5a48', '#3b5a7a', '#6b4a7a', '#7a7469']

export interface ProjectEditorRequest {
  mode: 'create' | 'edit'
  project?: Project
}

interface Props {
  request: ProjectEditorRequest
  onClose: () => void
  onSave: (input: { name: string; color: string }, existingId: string | null) => void
  onDelete?: (project: Project) => void
}

export function ProjectEditorSheet({ request, onClose, onSave, onDelete }: Props) {
  const p = request.project
  const [name, setName] = useState(p?.name ?? '')
  const [color, setColor] = useState(p?.color ?? COLORS[0])

  const save = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), color }, p?.id ?? null)
    onClose()
  }

  return (
    <BottomSheet
      title={request.mode === 'edit' ? 'Edit project' : 'New project'}
      onClose={onClose}
    >
      <label className="field">
        <span className="field__label">Name</span>
        <input
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
        />
      </label>

      <span className="field__label">Colour</span>
      <div className="chip-row">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            className={`swatch${color === c ? ' swatch--on' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      <div className="sheet-actions">
        {request.mode === 'edit' && p && onDelete && (
          <button
            className="btn btn--danger-ghost"
            onClick={() => {
              onDelete(p)
              onClose()
            }}
          >
            Delete
          </button>
        )}
        <button className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn--primary" disabled={!name.trim()} onClick={save}>
          Save
        </button>
      </div>
    </BottomSheet>
  )
}
