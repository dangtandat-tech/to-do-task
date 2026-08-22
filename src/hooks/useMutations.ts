import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Profile, Project, Quadrant, ScheduleBlock, Task } from '../lib/types'

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('Not signed in')
  return id
}

export function useProjectMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['projects'] })

  const createProject = useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const user_id = await uid()
      fail((await supabase.from('projects').insert({ ...input, user_id })).error)
    },
    onSuccess: invalidate,
  })

  const updateProject = useMutation({
    mutationFn: async (input: { id: string } & Partial<Pick<Project, 'name' | 'color' | 'archived'>>) => {
      const { id, ...patch } = input
      fail((await supabase.from('projects').update(patch).eq('id', id)).error)
    },
    onSuccess: invalidate,
  })

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      fail((await supabase.from('projects').delete().eq('id', id)).error)
    },
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['blocks'] })
    },
  })

  return { createProject, updateProject, deleteProject }
}

export interface TaskInput {
  project_id: string
  parent_id: string | null
  title: string
  quadrant: Quadrant
  due_date: string | null
  estimate_min: number | null
}

export function useTaskMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['blocks'] })
  }

  const createTask = useMutation({
    mutationFn: async (input: TaskInput): Promise<Task> => {
      const user_id = await uid()
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...input, user_id })
        .select()
        .single()
      fail(error)
      return data as Task
    },
    onSuccess: invalidate,
  })

  const updateTask = useMutation({
    mutationFn: async (input: { id: string } & Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>>) => {
      const { id, ...patch } = input
      fail((await supabase.from('tasks').update(patch).eq('id', id)).error)
    },
    onSuccess: invalidate,
  })

  const setCompleted = useMutation({
    mutationFn: async (input: { id: string; completed: boolean }) => {
      fail(
        (
          await supabase
            .from('tasks')
            .update({ completed_at: input.completed ? new Date().toISOString() : null })
            .eq('id', input.id)
        ).error,
      )
    },
    onSuccess: invalidate,
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      fail((await supabase.from('tasks').delete().eq('id', id)).error)
    },
    onSuccess: invalidate,
  })

  return { createTask, updateTask, setCompleted, deleteTask }
}

export interface PlanInput {
  task_id: string
  entries: { day: string; start_min: number }[]
  duration_min: number
}

export function useScheduleMutations() {
  const qc = useQueryClient()
  const invalidateBlocks = () => {
    qc.invalidateQueries({ queryKey: ['blocks'] })
    qc.invalidateQueries({ queryKey: ['taskBlocks'] })
  }

  /** One logical plan = one block per selected day, sharing a plan_group_id. */
  const createPlan = useMutation({
    mutationFn: async (input: PlanInput) => {
      const user_id = await uid()
      const plan_group_id = crypto.randomUUID()
      const rows = input.entries.map((e) => ({
        user_id,
        task_id: input.task_id,
        plan_group_id,
        day: e.day,
        start_min: e.start_min,
        duration_min: input.duration_min,
      }))
      fail((await supabase.from('schedule_blocks').insert(rows)).error)
    },
    onSuccess: invalidateBlocks,
  })

  /** Optimistically move one block to a new day/time within the visible week. */
  const moveBlock = useMutation({
    mutationFn: async (input: { id: string; day: string; start_min: number; weekStart: string }) => {
      fail(
        (
          await supabase
            .from('schedule_blocks')
            .update({ day: input.day, start_min: input.start_min })
            .eq('id', input.id)
        ).error,
      )
    },
    onMutate: async (input) => {
      const key = ['blocks', input.weekStart]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ScheduleBlock[]>(key)
      qc.setQueryData<ScheduleBlock[]>(key, (old) =>
        (old ?? []).map((b) =>
          b.id === input.id ? { ...b, day: input.day, start_min: input.start_min } : b,
        ),
      )
      return { prev, key }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: invalidateBlocks,
  })

  const resizeBlock = useMutation({
    mutationFn: async (input: { id: string; duration_min: number }) => {
      fail(
        (
          await supabase
            .from('schedule_blocks')
            .update({ duration_min: input.duration_min })
            .eq('id', input.id)
        ).error,
      )
    },
    onSuccess: invalidateBlocks,
  })

  const deletePlan = useMutation({
    mutationFn: async (plan_group_id: string) => {
      fail((await supabase.from('schedule_blocks').delete().eq('plan_group_id', plan_group_id)).error)
    },
    onSuccess: invalidateBlocks,
  })

  /** Used when a scheduled task gains its first subtask. */
  const deleteBlocksForTask = useMutation({
    mutationFn: async (task_id: string) => {
      fail((await supabase.from('schedule_blocks').delete().eq('task_id', task_id)).error)
    },
    onSuccess: invalidateBlocks,
  })

  return { createPlan, moveBlock, resizeBlock, deletePlan, deleteBlocksForTask }
}

export function useProfileMutations() {
  const qc = useQueryClient()
  const updateProfile = useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, 'id'>>) => {
      const id = await uid()
      fail((await supabase.from('profiles').update(patch).eq('id', id)).error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
  return { updateProfile }
}
