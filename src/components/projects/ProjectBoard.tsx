import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useProjects, useTasks } from '../../hooks/useData'
import { useTaskTree } from '../../hooks/useDerived'
import {
  useProjectMutations,
  useScheduleMutations,
  useTaskMutations,
} from '../../hooks/useMutations'
import type { TaskInput } from '../../hooks/useMutations'
import type { Project, Task } from '../../lib/types'
import { Icon } from '../Icon'
import { TaskRow } from './TaskCard'
import { TaskEditorSheet } from '../sheets/TaskEditorSheet'
import type { TaskEditorRequest } from '../sheets/TaskEditorSheet'
import { ProjectEditorSheet } from '../sheets/ProjectEditorSheet'
import type { ProjectEditorRequest } from '../sheets/ProjectEditorSheet'
import { PlanScheduleSheet } from '../sheets/PlanScheduleSheet'
import { ConfirmSheet } from '../sheets/ConfirmSheet'
import type { ConfirmRequest } from '../sheets/ConfirmSheet'

/**
 * The project → task → subtask board. Owns its editor sheets.
 * `draggable` turns leaf tasks into drag sources (desktop planner pane).
 */
export function ProjectBoard({ draggable = false }: { draggable?: boolean }) {
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const { data: tasks, isLoading: loadingTasks } = useTasks()
  const tree = useTaskTree(tasks)
  const { createProject, updateProject, deleteProject } = useProjectMutations()
  const { createTask, updateTask, setCompleted, deleteTask } = useTaskMutations()
  const { createPlan, deleteBlocksForTask } = useScheduleMutations()

  const [taskEditor, setTaskEditor] = useState<TaskEditorRequest | null>(null)
  const [projectEditor, setProjectEditor] = useState<ProjectEditorRequest | null>(null)
  const [planTask, setPlanTask] = useState<Task | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const saveTask = async (input: TaskInput, existingId: string | null) => {
    if (existingId) {
      updateTask.mutate({ id: existingId, ...input })
      return
    }
    if (input.parent_id) {
      // First subtask of a scheduled parent removes the parent's own schedule.
      const { data } = await supabase
        .from('schedule_blocks')
        .select('id')
        .eq('task_id', input.parent_id)
        .limit(1)
      if (data && data.length > 0) {
        setConfirm({
          title: 'Replace parent schedule?',
          message:
            'This task is already planned on the calendar. Adding a subtask removes the parent’s own schedule — you will plan the subtasks instead.',
          confirmLabel: 'Add subtask',
          onConfirm: () => {
            deleteBlocksForTask.mutate(input.parent_id!)
            createTask.mutate(input)
          },
        })
        return
      }
    }
    createTask.mutate(input)
  }

  const removeTask = (task: Task) => {
    setConfirm({
      title: 'Delete task?',
      message: `“${task.title}” and its subtasks and scheduled time will be removed.`,
      onConfirm: () => deleteTask.mutate(task.id),
    })
  }

  const removeProject = (project: Project) => {
    setConfirm({
      title: 'Delete project?',
      message: `“${project.name}” and everything inside it will be removed.`,
      onConfirm: () => deleteProject.mutate(project.id),
    })
  }

  if (loadingProjects || loadingTasks) {
    return (
      <div className="board">
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    )
  }

  return (
    <div className="board">
      {(projects ?? []).map((p) => {
        const nodes = tree.get(p.id) ?? []
        const doneCount = nodes.filter((n) => n.task.completed_at).length
        return (
          <section className="project-box" key={p.id} style={{ borderTopColor: p.color }}>
            <header className="project-box__header">
              <h2 className="project-box__name">{p.name}</h2>
              {nodes.length > 0 && (
                <span className="project-box__count">
                  {doneCount}/{nodes.length}
                </span>
              )}
              <span className="project-box__actions">
                <button
                  className="icon-btn"
                  aria-label="Edit project"
                  onClick={() => setProjectEditor({ mode: 'edit', project: p })}
                >
                  <Icon name="pencil" size={15} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Add task"
                  onClick={() =>
                    setTaskEditor({ mode: 'create', projectId: p.id, parentId: null })
                  }
                >
                  <Icon name="plus" size={17} />
                </button>
              </span>
            </header>

            {nodes.length === 0 && <p className="empty-note">No tasks yet — tap +.</p>}

            {nodes.map(({ task, children }) => {
              const doneKids = children.filter((c) => c.completed_at).length
              return (
                <div className="task-group" key={task.id}>
                  <TaskRow
                    task={task}
                    isSub={false}
                    childProgress={children.length > 0 ? [doneKids, children.length] : null}
                    canComplete={children.length === 0 || doneKids === children.length}
                    onToggleDone={() =>
                      setCompleted.mutate({ id: task.id, completed: !task.completed_at })
                    }
                    onEdit={() =>
                      setTaskEditor({
                        mode: 'edit',
                        projectId: p.id,
                        parentId: null,
                        task,
                      })
                    }
                    onPlan={children.length === 0 ? () => setPlanTask(task) : undefined}
                    onAddSub={() =>
                      setTaskEditor({ mode: 'create', projectId: p.id, parentId: task.id })
                    }
                    draggable={draggable && children.length === 0}
                  />
                  {children.map((sub) => (
                    <TaskRow
                      key={sub.id}
                      task={sub}
                      isSub
                      childProgress={null}
                      canComplete
                      onToggleDone={() =>
                        setCompleted.mutate({ id: sub.id, completed: !sub.completed_at })
                      }
                      onEdit={() =>
                        setTaskEditor({
                          mode: 'edit',
                          projectId: p.id,
                          parentId: task.id,
                          task: sub,
                        })
                      }
                      onPlan={() => setPlanTask(sub)}
                      draggable={draggable}
                    />
                  ))}
                </div>
              )
            })}
          </section>
        )
      })}

      <button
        className="btn btn--ghost board__add"
        onClick={() => setProjectEditor({ mode: 'create' })}
      >
        <Icon name="plus" size={16} /> New project
      </button>

      {taskEditor && (
        <TaskEditorSheet
          request={taskEditor}
          onClose={() => setTaskEditor(null)}
          onSave={saveTask}
          onDelete={removeTask}
        />
      )}
      {projectEditor && (
        <ProjectEditorSheet
          request={projectEditor}
          onClose={() => setProjectEditor(null)}
          onSave={(input, id) =>
            id ? updateProject.mutate({ id, ...input }) : createProject.mutate(input)
          }
          onDelete={removeProject}
        />
      )}
      {planTask && (
        <PlanScheduleSheet
          task={planTask}
          onClose={() => setPlanTask(null)}
          onSave={(input) => createPlan.mutate(input)}
        />
      )}
      {confirm && <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}
