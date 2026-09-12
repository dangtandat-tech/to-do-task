import { useQuery } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { fromDateStr } from '../lib/time'
import type { Profile, Project, ScheduleBlock, Task } from '../lib/types'

async function throwOnError<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile> => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) throw new Error('Not signed in')
      return throwOnError<Profile>(
        supabase.from('profiles').select('*').eq('id', uid).single(),
      )
    },
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () =>
      throwOnError<Project[]>(
        supabase
          .from('projects')
          .select('*')
          .eq('archived', false)
          .order('sort_order')
          .order('created_at'),
      ),
  })
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () =>
      throwOnError<Task[]>(
        supabase.from('tasks').select('*').order('sort_order').order('created_at'),
      ),
  })
}

/**
 * Every block of every task, used where progress is shown outside one week
 * (the project board). A personal planner holds a few hundred of these.
 */
export function useAllBlocks() {
  return useQuery({
    queryKey: ['blocks', 'all'],
    queryFn: () =>
      throwOnError<ScheduleBlock[]>(
        supabase.from('schedule_blocks').select('*').order('day'),
      ),
  })
}

/** All schedule blocks for the Monday-first week starting at `weekStart` (yyyy-MM-dd). */
export function useWeekBlocks(weekStart: string) {
  const weekEnd = format(addDays(fromDateStr(weekStart), 6), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['blocks', weekStart],
    queryFn: () =>
      throwOnError<ScheduleBlock[]>(
        supabase
          .from('schedule_blocks')
          .select('*')
          .gte('day', weekStart)
          .lte('day', weekEnd)
          .order('start_min'),
      ),
  })
}
