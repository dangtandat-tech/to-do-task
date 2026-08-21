export type Quadrant = 'urgent_important' | 'important' | 'urgent' | 'neither'

export interface Profile {
  id: string
  display_name: string | null
  day_capacity_min: number
  day_start_min: number
  day_end_min: number
}

export interface Project {
  id: string
  user_id: string
  name: string
  color: string
  sort_order: number
  archived: boolean
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  project_id: string
  parent_id: string | null
  title: string
  quadrant: Quadrant
  due_date: string | null
  estimate_min: number | null
  completed_at: string | null
  sort_order: number
  created_at: string
}

export interface ScheduleBlock {
  id: string
  user_id: string
  task_id: string
  plan_group_id: string
  day: string
  start_min: number
  duration_min: number
  created_at: string
}
