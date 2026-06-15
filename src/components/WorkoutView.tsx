import React, { useState } from 'react'
import type { StoredWorkout } from '../types.ts'
import type { SetEntry, ExerciseEntry, WorkoutItem } from '../../dsl/ast.ts'
import { encodeWorkoutLink, shareOrDownloadWorkout } from '../shareWorkout.ts'

interface Props {
  workout: StoredWorkout
  onBack: () => void
  readOnly?: boolean
  onAddToWorkouts?: () => void
  onEdit?: () => void
  onEditDSL?: () => void
  onDelete?: () => void
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

export default function WorkoutView({ workout, onBack, readOnly, onAddToWorkouts, onEdit, onEditDSL, onDelete }: Props) {
  const { entry } = workout
  const hasContent = entry.exercises.length > 0 || entry.supersets.length > 0
  const [shareOpen, setShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
  const [copyDslStatus, setCopyDslStatus] = useState<'idle' | 'copied'>('idle')

  // Ordered items: use items array if present (new entries), otherwise fall back
  // to exercises-then-supersets for entries stored before this feature landed.
  const items: WorkoutItem[] = entry.items ?? [
    ...entry.exercises.map((exercise) => ({ kind: 'exercise' as const, exercise })),
    ...entry.supersets.map((superset) => ({ kind: 'superset' as const, superset })),
  ]

  async function handleCopyLink() {
    const url = encodeWorkoutLink(workout.raw)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      prompt('Copy this link:', url)
      return
    }
    setCopyStatus('copied')
    setTimeout(() => setCopyStatus('idle'), 2000)
  }

  async function handleCopyDsl() {
    try {
      await navigator.clipboard.writeText(workout.raw)
    } catch {
      prompt('Copy this DSL:', workout.raw)
      return
    }
    setCopyDslStatus('copied')
    setTimeout(() => setCopyDslStatus('idle'), 2000)
  }

  return (
    <div className="workout-wrap">
      <div className="back-row">
        <button className="btn-back" onClick={onBack}>
          ‹ Back
        </button>
      </div>

      {readOnly && (
        <div className="shared-banner">Shared workout — not saved to your library</div>
      )}

      <h1 className="workout-date">{formatDate(entry.date)}</h1>
      {entry.note && <p className="workout-note">{entry.note}</p>}

      {!hasContent && (
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px', fontStyle: 'italic' }}>
          No exercises recorded yet.
        </p>
      )}

      {/* Items in source order */}
      {items.length > 0 && (
        <div style={{ marginTop: entry.note ? '0' : '24px' }}>
          {items.map((item, i) =>
            item.kind === 'exercise' ? (
              <div key={i} className="card">
                <div className="exercise-name">{item.exercise.name}</div>
                <ExerciseTable exercise={item.exercise} />
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
                      <ExerciseTable exercise={ex} />
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {readOnly ? (
        <div className="workout-actions">
          <button className="btn-primary" onClick={onAddToWorkouts}>Add to my workouts</button>
        </div>
      ) : (
        <>
          <div className="workout-actions">
            <button className="btn-primary" onClick={onEdit}>Edit Workout</button>
            <button className="btn-ghost" onClick={onEditDSL}>Edit DSL</button>
            <button className="btn-ghost" onClick={handleCopyDsl}>
              {copyDslStatus === 'copied' ? 'Copied!' : 'Copy DSL'}
            </button>
            <button className="btn-ghost" onClick={() => setShareOpen(o => !o)}>
              {shareOpen ? 'Close' : 'Share'}
            </button>
            <button
              className="btn-ghost"
              onClick={() => { if (confirm('Delete this workout?')) onDelete?.() }}
              style={{ marginLeft: 'auto', color: '#ef4444', borderColor: '#3f1515' }}
            >
              Delete
            </button>
          </div>

          {shareOpen && (
            <div className="share-menu">
              <button className="share-menu-btn" onClick={handleCopyLink}>
                {copyStatus === 'copied' ? 'Copied!' : 'Copy Link'}
              </button>
              <button className="share-menu-btn" onClick={() => shareOrDownloadWorkout(entry)}>
                {'share' in navigator ? 'Share Image' : 'Save Image'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
