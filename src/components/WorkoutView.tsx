import React from 'react'
import type { StoredWorkout } from '../types.ts'
import type { SetEntry, ExerciseEntry } from '../../dsl/ast.ts'

interface Props {
  workout: StoredWorkout
  onEdit: () => void
  onEditDSL: () => void
  onBack: () => void
  onDelete: () => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Format MM/DD/YY as "June 15, 2025" */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Untitled Workout'
  // dateStr is MM/DD/YY
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr
  const mm = parseInt(parts[0], 10) - 1 // 0-based
  const dd = parseInt(parts[1], 10)
  const yy = parseInt(parts[2], 10)
  const fullYear = yy < 70 ? 2000 + yy : 1900 + yy
  const month = MONTH_NAMES[mm] ?? parts[0]
  return `${month} ${dd}, ${fullYear}`
}

function formatReps(reps: SetEntry['reps']): string {
  if (typeof reps === 'number') return String(reps)
  return `${reps.seconds}s`
}

function formatWeight(weight: SetEntry['weight']): string {
  if (weight.value === 0) return '—'
  return `${weight.value} ${weight.unit}`
}

function ExerciseTable({ exercise }: { exercise: ExerciseEntry }) {
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

export default function WorkoutView({ workout, onEdit, onEditDSL, onBack, onDelete }: Props) {
  const { entry } = workout
  const hasContent = entry.exercises.length > 0 || entry.supersets.length > 0

  return (
    <div className="workout-wrap">
      <div className="back-row">
        <button className="btn-back" onClick={onBack}>
          ‹ Back
        </button>
      </div>

      <h1 className="workout-date">{formatDate(entry.date)}</h1>
      {entry.note && <p className="workout-note">{entry.note}</p>}

      {!hasContent && (
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px', fontStyle: 'italic' }}>
          No exercises recorded yet.
        </p>
      )}

      {/* Standalone exercises */}
      {entry.exercises.length > 0 && (
        <div className={entry.supersets.length > 0 ? 'section-gap' : ''} style={{ marginTop: entry.note ? '0' : '24px' }}>
          {entry.exercises.map((ex, i) => (
            <div key={i} className="card">
              <div className="exercise-name">{ex.name}</div>
              <ExerciseTable exercise={ex} />
            </div>
          ))}
        </div>
      )}

      {/* Supersets */}
      {entry.supersets.length > 0 && (
        <div className="section-gap">
          {entry.supersets.map((ss, si) => (
            <div key={si} className="card">
              <div className="card-header">
                <span className="badge badge-accent">Superset</span>
              </div>
              <div className="superset-exercises">
                {ss.exercises.map((ex, ei) => (
                  <div key={ei}>
                    <div className="superset-exercise-name">{ex.name}</div>
                    <ExerciseTable exercise={ex} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="workout-actions">
        <button className="btn-primary" onClick={onEdit}>Edit Workout</button>
        <button className="btn-ghost" onClick={onEditDSL}>Edit DSL</button>
        <button
          className="btn-ghost"
          onClick={() => {
            if (confirm('Delete this workout?')) onDelete()
          }}
          style={{ marginLeft: 'auto', color: '#ef4444', borderColor: '#3f1515' }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
