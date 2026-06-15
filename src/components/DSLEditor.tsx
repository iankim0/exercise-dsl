import React, { useState, useMemo } from 'react'
import type { WorkoutEntry, SetEntry, ExerciseEntry, WorkoutItem } from '../../dsl/ast.ts'
import { parseWorkout } from '../../dsl/parser.ts'

interface Props {
  initialRaw: string
  onSave: (raw: string, entry: WorkoutEntry) => void
  onCancel: () => void
}

function formatReps(reps: SetEntry['reps']): string {
  if (typeof reps === 'number') return String(reps)
  return `${reps.seconds}s`
}

function formatWeight(weight: SetEntry['weight']): string {
  if (weight.value === 0) return '—'
  return `${weight.value} ${weight.unit}`
}

function PreviewExerciseTable({ exercise }: { exercise: ExerciseEntry }) {
  return (
    <table className="set-table">
      <thead>
        <tr>
          <th className="set-num">Set</th>
          <th>Reps</th>
          <th>Weight</th>
        </tr>
      </thead>
      <tbody>
        {exercise.sets.map((set) => (
          <tr key={set.setNumber}>
            <td className="set-num">{set.setNumber}</td>
            <td>{formatReps(set.reps)}</td>
            <td>{formatWeight(set.weight)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function DSLEditor({ initialRaw, onSave, onCancel }: Props) {
  const [raw, setRaw] = useState(initialRaw)

  const { entry, warnings } = useMemo(() => parseWorkout(raw), [raw])

  const hasContent = entry.exercises.length > 0 || entry.supersets.length > 0

  const items: WorkoutItem[] = entry.items ?? [
    ...entry.exercises.map((exercise) => ({ kind: 'exercise' as const, exercise })),
    ...entry.supersets.map((superset) => ({ kind: 'superset' as const, superset })),
  ]

  return (
    <div className="editor-wrap">
      <div className="editor-label">Write your workout</div>
      <textarea
        rows={12}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={`D: 06/11/25\nN: Leg day\nSquat 4x5 @ 225lbs\nS: Leg Press 3x10 @ 180lbs, Leg Curl 3x10 @ 90lbs`}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {warnings.length > 0 && (
        <div className="warning-list">
          {warnings.map((w, i) => (
            <div key={i} className="warning-pill">
              ⚠ {w.message}
            </div>
          ))}
        </div>
      )}

      <hr className="editor-divider" />

      <div className="preview-label">Preview</div>

      {!hasContent ? (
        <p className="preview-empty">Nothing to preview yet</p>
      ) : (
        <>
          {items.map((item, i) =>
            item.kind === 'exercise' ? (
              <div key={i} className="card">
                <div className="exercise-name">{item.exercise.name}</div>
                <PreviewExerciseTable exercise={item.exercise} />
              </div>
            ) : (
              <div key={i} className="card">
                <div className="card-header">
                  <span className="badge badge-accent">Superset</span>
                </div>
                <div className="superset-exercises">
                  {item.superset.exercises.map((ex, ei) => (
                    <div key={ei}>
                      <div className="superset-exercise-name">{ex.name}</div>
                      <PreviewExerciseTable exercise={ex} />
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </>
      )}

      <div className="editor-actions">
        <button
          className="btn-primary"
          disabled={!hasContent}
          onClick={() => onSave(raw, entry)}
        >
          Save Workout
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
