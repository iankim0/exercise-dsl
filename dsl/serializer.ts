import type { WorkoutEntry, ExerciseEntry, SetEntry } from './ast.ts'

function serializeReps(sets: SetEntry[]): string {
  const first = sets[0].reps
  // Timed sets — always uniform per grammar
  if (typeof first === 'object') {
    return `${first.seconds}sec`
  }
  const values = sets.map((s) => s.reps as number)
  const uniform = values.every((v) => v === values[0])
  return uniform ? String(values[0]) : `[${values.join(',')}]`
}

function serializeWeight(sets: SetEntry[]): string {
  const allZero = sets.every((s) => s.weight.value === 0)
  if (allZero) return ''

  const values = sets.map((s) => s.weight.value)
  const units = sets.map((s) => s.weight.unit)
  const uniformUnit = units.every((u) => u === units[0])
  const uniformValue = values.every((v) => v === values[0])

  if (uniformUnit) {
    const unit = units[0]
    if (uniformValue) return ` @ ${values[0]}${unit}`
    return ` @ [${values.join(',')}]${unit}`
  }

  // Mixed units — serialize each element with its own unit
  const items = sets.map((s) => `${s.weight.value}${s.weight.unit}`)
  return ` @ [${items.join(',')}]`
}

function serializeExercise(ex: ExerciseEntry): string {
  const sets = ex.sets.length
  const repsPart = serializeReps(ex.sets)
  const weightPart = serializeWeight(ex.sets)
  return `${ex.name} ${sets}x${repsPart}${weightPart}`
}

export function serialize(entry: WorkoutEntry): string {
  const lines: string[] = []

  if (entry.date) lines.push(`D: ${entry.date}`)
  if (entry.note) lines.push(`N: ${entry.note}`)

  // Use items (ordered) if present; fall back to exercises-then-supersets for legacy data.
  const items = entry.items ?? [
    ...entry.exercises.map((exercise) => ({ kind: 'exercise' as const, exercise })),
    ...entry.supersets.map((superset) => ({ kind: 'superset' as const, superset })),
  ]

  for (const item of items) {
    if (item.kind === 'exercise') {
      lines.push(serializeExercise(item.exercise))
    } else {
      lines.push(`S: ${item.superset.exercises.map(serializeExercise).join(', ')}`)
    }
  }

  return lines.join('\n')
}
