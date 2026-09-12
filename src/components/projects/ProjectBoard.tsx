import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { todayStr } from '../../lib/time'
import {
  finishedDays,
  resolvePlan,
  rollupParent,
  sessionCount,
  taskProgress,
} from '../../lib/smart'
import { useTimer } from '../../context/TimerContext'
import { useAllBlocks, useProfile, useProjects, useTasks } from '../../hooks/useData'
import { useTaskTree } from '../../hooks/useDerived'
import { useShowCompleted } from '../../hooks/useShowCompleted'
import {
  useProjectMutations,
  useScheduleMutations,
  useTaskMutations,
} from '../../hooks/useMutations'
import type { TaskInput } from '../../hooks/useMutations'
import type { Project, ScheduleBlock, Task } from '../../lib/types'
import { Icon } from '../Icon'
import { TaskRow } from './TaskCard'
import { TaskEditorSheet } from '../sheets/TaskEditorSheet'
import type { TaskEditorRequest } from '../sheets/TaskEditorSheet'
import type { PlanFields } from '../../lib/types'
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
  const { data: profile } = useProfile()
  const { data: allBlocks } = useAllBlocks()
  const timer = useTimer()
  // planned days per task drive both the progress bar and the "1/3" chip
  const blocksByTask = useMemo(() => {
    const m = new Map<string, ScheduleBlock[]>()
    for (const b of allBlocks ?? []) {
      const arr = m.get(b.task_id) ?? []
      arr.push(b)
      m.set(b.task_id, arr)
    }
    return m
  }, [allBlocks])
  const tree = useTaskTree(tasks)
  const [showCompleted, setShowCompleted] = useShowCompleted()
  const { createProject, updateProject, deleteProject } = useProjectMutations()
  const { createTask, updateTask, setCompleted, deleteTask } = useTaskMutations()
  const { createPlan, deleteBlocksForTask } = useScheduleMutations()

  const [taskEditor, setTaskEditor] = useState<TaskEditorRequest | null>(null)
  const [projectEditor, setProjectEditor] = useState<ProjectEditorRequest | null>(null)
  const [planTask, setPlanTask] = useState<Task | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  /** the task's schedule is a single unit: replace it wholesale */
  const replaceSchedule = async (task: Task, plan: PlanFields) => {
    const keepDone = await finishedDays(task.id)
    await deleteBlocksForTask.mutateAsync(task.id)
    if (plan.days.length === 0) return
    const resolved = await resolvePlan(
      task,
      plan,
      profile?.day_start_min ?? 360,
      profile?.day_end_min ?? 1380,
    )
    createPlan.mutate({ task_id: task.id, ...resolved, keepDone })
  }

  const saveTask = async (
    input: TaskInput,
    existingId: string | null,
    plan: PlanFields | null,
  ) => {
    if (existingId) {
      updateTask.mutate({ id: existingId, ...input })
      if (plan) {
        const base = (tasks ?? []).find((x) => x.id === existingId)
        if (base) await replaceSchedule({ ...base, ...input }, plan)
      }
      return
    }
    const createWithPlan = async () => {
      const created = await createTask.mutateAsync(input)
      if (plan && plan.days.length > 0) await replaceSchedule(created, plan)
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
            void createWithPlan()
          },
        })
        return
      }
    }
    void createWithPlan()
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

  const doneTotal = (tasks ?? []).filter((t) => t.completed_at).length

  return (
    <div className="board">
      <div className="board__tools">
        <button
          className={`toggle-chip${showCompleted ? ' toggle-chip--on' : ''}`}
          aria-pressed={showCompleted}
          title={showCompleted ? 'Hide completed work' : 'Show completed work'}
          onClick={() => setShowCompleted(!showCompleted)}
        >
          <Icon name={showCompleted ? 'eye' : 'eyeOff'} size={14} />
          {showCompleted ? 'Done shown' : 'Done hidden'}
          {doneTotal > 0 && <span className="toggle-chip__n">{doneTotal}</span>}
        </button>
      </div>

      {(projects ?? []).map((p) => {
        const allNodes = tree.get(p.id) ?? []
        const doneCount = allNodes.filter((n) => n.task.completed_at).length
        const dueNowCount = allNodes
          .flatMap((n) => [n.task, ...n.children])
          .filter((t) => !t.completed_at && t.due_date && t.due_date <= todayStr()).length
        // A completed parent can only exist once every subtask is done, so
        // hiding it hides the whole group; open parents keep their rollup
        // counts and only drop their finished subtask rows.
        const nodes = showCompleted
          ? allNodes
          : allNodes.filter((n) => !n.task.completed_at)
        const hiddenCount =
          allNodes.flatMap((n) => [n.task, ...n.children]).filter((t) => t.completed_at)
            .length
        return (
          <section className="project-box" key={p.id} style={{ borderTopColor: p.color }}>
            <header className="project-box__header">
              <h2 className="project-box__name">{p.name}</h2>
              {dueNowCount > 0 && (
                <span className="project-box__due">{dueNowCount} due</span>
              )}
              {allNodes.length > 0 && (
                <span className="project-box__count">
                  {doneCount}/{allNodes.length}
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

            {nodes.length === 0 && (
              <p className="empty-note">
                {allNodes.length === 0
                  ? 'No tasks yet — tap +.'
                  : `All done — ${hiddenCount} completed hidden.`}
              </p>
            )}

            {nodes.map(({ task, children }) => {
              const doneKids = children.filter((c) => c.completed_at).length
              const rollup = rollupParent(task, children)
              const shownKids = showCompleted
                ? children
                : children.filter((c) => !c.completed_at)
              return (
                <div className="task-group" key={task.id}>
                  <TaskRow
                    task={task}
                    isSub={false}
                    childProgress={children.length > 0 ? [doneKids, children.length] : null}
                    canComplete={children.length === 0 || doneKids === children.length}
                    metaEstimate={rollup.estimateMin}
                    metaDue={rollup.dueDate}
                    progress={taskProgress(task, children, blocksByTask)}
                    sessionProgress={sessionCount(blocksByTask.get(task.id))}
                    onToggleDone={() =>
                      setCompleted.mutate({ id: task.id, completed: !task.completed_at })
                    }
                    onEdit={() =>
                      setTaskEditor({
                        mode: 'edit',
                        projectId: p.id,
                        parentId: null,
                        task,
                        canPlan: children.length === 0,
                        rolledEstimate: rollup.estimateMin,
                      })
                    }
                    onPlan={children.length === 0 ? () => setPlanTask(task) : undefined}
                    onStartTimer={
                      children.length === 0 ? () => timer.start(task.id) : undefined
                    }
                    onAddSub={() =>
                      setTaskEditor({ mode: 'create', projectId: p.id, parentId: task.id })
                    }
                    draggable={draggable && children.length === 0}
                  />
                  {shownKids.map((sub) => (
                    <TaskRow
                      key={sub.id}
                      task={sub}
                      isSub
                      childProgress={null}
                      canComplete
                      progress={taskProgress(sub, [], blocksByTask)}
                      sessionProgress={sessionCount(blocksByTask.get(sub.id))}
                      onStartTimer={() => timer.start(sub.id)}
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
          onSave={(plan) => void replaceSchedule(planTask, plan)}
        />
      )}
      {confirm && <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}
