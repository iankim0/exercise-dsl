import type { WorkoutEntry } from '../dsl/ast.ts'

export type StoredWorkout = {
  id: string
  raw: string
  entry: WorkoutEntry
}

export type View =
  | { type: 'calendar' }
  | { type: 'workout'; id: string }
  | { type: 'add'; prefillDate?: string }
  | { type: 'edit'; id: string }
  | { type: 'editDSL'; id: string }
