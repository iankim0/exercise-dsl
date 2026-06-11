import type { StoredWorkout } from './types.ts'

const KEY = 'lift_workouts'
const EXPORT_VERSION = 1

export type ExportFile = {
  version: number
  exportedAt: string
  workouts: Record<string, StoredWorkout>
}

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

export function exportWorkouts(): void {
  const payload: ExportFile = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    workouts: loadWorkouts(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `lift-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Merges imported workouts into localStorage. Imported entries overwrite on ID conflict. */
export function importWorkouts(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as ExportFile
        const incoming = raw.workouts ?? raw // gracefully handle bare Record too
        if (typeof incoming !== 'object' || Array.isArray(incoming)) {
          throw new Error('Invalid format')
        }
        const all = loadWorkouts()
        let count = 0
        for (const [id, w] of Object.entries(incoming)) {
          if (w && typeof w === 'object' && 'id' in w && 'raw' in w && 'entry' in w) {
            all[id] = w as StoredWorkout
            count++
          }
        }
        localStorage.setItem(KEY, JSON.stringify(all))
        resolve(count)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}
