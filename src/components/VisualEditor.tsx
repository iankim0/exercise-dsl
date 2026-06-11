import React, { useState } from 'react'
import type { StoredWorkout } from '../types.ts'
import type { WorkoutEntry, ExerciseEntry, SetEntry, Unit } from '../../dsl/ast.ts'

interface Props {
  workout: StoredWorkout
  onSave: (updated: StoredWorkout) => void
  onCancel: () => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Untitled Workout'
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr
  const mm = parseInt(parts[0], 10) - 1
  const dd = parseInt(parts[1], 10)
  const yy = parseInt(parts[2], 10)
  const fullYear = yy < 70 ? 2000 + yy : 1900 + yy
  const month = MONTH_NAMES[mm] ?? parts[0]
  return `${month} ${dd}, ${fullYear}`
}

/** Deep-clone a WorkoutEntry so mutations don't affect the original */
function cloneEntry(entry: WorkoutEntry): WorkoutEntry {
  return JSON.parse(JSON.stringify(entry))
}

interface SetRowProps {
  set: SetEntry
  onRepsChange: (v: number) => void
  onWeightChange: (v: number) => void
  onUnitToggle: () => void
}

function SetRow({ set, onRepsChange, onWeightChange, onUnitToggle }: SetRowProps) {
  const repsValue = typeof set.reps === 'number' ? set.reps : set.reps.seconds

  return (
    <div className="edit-row">
      <span className="edit-set-num">{set.setNumber}</span>
      <input
        type="number"
        min={1}
        value={repsValue}
        onChange={(e) => onRepsChange(parseInt(e.target.value, 10) || 1)}
        aria-label={`Set ${set.setNumber} reps`}
      />
      <input
        type="number"
        min={0}
        step={0.5}
        value={set.weight.value}
        onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
        aria-label={`Set ${set.setNumber} weight`}
      />
      <button className="unit-toggle" onClick={onUnitToggle} title="Toggle unit">
        {set.weight.unit}
      </button>
    </div>
  )
}

interface ExerciseEditorProps {
  exercise: ExerciseEntry
  onChange: (updated: ExerciseEntry) => void
}

function ExerciseEditor({ exercise, onChange }: ExerciseEditorProps) {
  function updateSet(setIndex: number, updater: (s: SetEntry) => SetEntry) {
    const newSets = exercise.sets.map((s, i) => i === setIndex ? updater(s) : s)
    onChange({ ...exercise, sets: newSets })
  }

  return (
    <div>
      {exercise.sets.map((set, si) => (
        <SetRow
          key={si}
          set={set}
          onRepsChange={(v) =>
            updateSet(si, (s) => ({
              ...s,
              reps: typeof s.reps === 'number' ? v : { seconds: v },
            }))
          }
          onWeightChange={(v) =>
            updateSet(si, (s) => ({ ...s, weight: { ...s.weight, value: v } }))
          }
          onUnitToggle={() =>
            updateSet(si, (s) => ({
              ...s,
              weight: {
                ...s.weight,
                unit: (s.weight.unit === 'lbs' ? 'kg' : 'lbs') as Unit,
              },
            }))
          }
        />
      ))}
    </div>
  )
}

export default function VisualEditor({ workout, onSave, onCancel }: Props) {
  const [editedEntry, setEditedEntry] = useState<WorkoutEntry>(() =>
    cloneEntry(workout.entry)
  )

  function updateExercise(index: number, updated: ExerciseEntry) {
    setEditedEntry((prev) => {
      const exercises = prev.exercises.map((ex, i) => (i === index ? updated : ex))
      return { ...prev, exercises }
    })
  }

  function updateSupersetExercise(ssIndex: number, exIndex: number, updated: ExerciseEntry) {
    setEditedEntry((prev) => {
      const supersets = prev.supersets.map((ss, si) => {
        if (si !== ssIndex) return ss
        const exercises = ss.exercises.map((ex, ei) => (ei === exIndex ? updated : ex))
        return { ...ss, exercises }
      })
      return { ...prev, supersets }
    })
  }

  function handleSave() {
    onSave({ ...workout, entry: { ...editedEntry, raw: workout.raw } })
  }

  return (
    <div className="visual-editor-wrap">
      <h2 className="visual-editor-heading">
        Editing {formatDate(editedEntry.date)}
      </h2>

      {/* Standalone exercises */}
      {editedEntry.exercises.map((ex, i) => (
        <div key={i} className="card">
          <div className="exercise-name">{ex.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr auto', gap: '8px', padding: '8px 0 4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>#</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reps</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weight</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, width: '44px' }}></span>
          </div>
          <ExerciseEditor
            exercise={ex}
            onChange={(updated) => updateExercise(i, updated)}
          />
        </div>
      ))}

      {/* Supersets */}
      {editedEntry.supersets.map((ss, si) => (
        <div key={si} className="card">
          <div className="card-header">
            <span className="badge badge-accent">Superset</span>
          </div>
          <div className="superset-exercises">
            {ss.exercises.map((ex, ei) => (
              <div key={ei}>
                <div className="superset-exercise-name">{ex.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr auto', gap: '8px', padding: '6px 0 2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>#</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reps</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weight</span>
                  <span></span>
                </div>
                <ExerciseEditor
                  exercise={ex}
                  onChange={(updated) => updateSupersetExercise(si, ei, updated)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {editedEntry.exercises.length === 0 && editedEntry.supersets.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          No exercises to edit. Use "Edit DSL" to add exercises first.
        </p>
      )}

      <div className="visual-actions">
        <button className="btn-primary" onClick={handleSave}>Save</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
