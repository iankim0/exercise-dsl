import type { StoredWorkout } from './types.ts'

const KEY = 'lift_workouts'

export function loadWorkouts(): Record<string, StoredWorkout> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveWorkout(w: StoredWorkout): void {
  const all = loadWorkouts()
  all[w.id] = w
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function deleteWorkout(id: string): void {
  const all = loadWorkouts()
  delete all[id]
  localStorage.setItem(KEY, JSON.stringify(all))
}
