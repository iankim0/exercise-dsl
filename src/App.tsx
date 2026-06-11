import React, { useState, useCallback, useEffect } from 'react'
import type { View, StoredWorkout } from './types.ts'
import { loadWorkouts, saveWorkout, deleteWorkout } from './store.ts'
import CalendarView from './components/CalendarView.tsx'
import WorkoutView from './components/WorkoutView.tsx'
import DSLEditor from './components/DSLEditor.tsx'
import VisualEditor from './components/VisualEditor.tsx'
import type { WorkoutEntry } from '../dsl/ast.ts'

export default function App() {
  const [view, setView] = useState<View>({ type: 'calendar' })
  const [workouts, setWorkouts] = useState<Record<string, StoredWorkout>>(() => loadWorkouts())

  // Sync workouts from localStorage on focus (in case another tab changed it)
  useEffect(() => {
    const handler = () => setWorkouts(loadWorkouts())
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  const navigate = useCallback((v: View) => setView(v), [])

  const handleSave = useCallback((raw: string, entry: WorkoutEntry) => {
    const id = entry.date
      ? `workout-${entry.date.replace(/\//g, '-')}`
      : `workout-${Date.now()}`
    const stored: StoredWorkout = { id, raw, entry: { ...entry, raw } }
    saveWorkout(stored)
    setWorkouts(loadWorkouts())
    setView({ type: 'workout', id })
  }, [])

  const handleVisualSave = useCallback((updated: StoredWorkout) => {
    saveWorkout(updated)
    setWorkouts(loadWorkouts())
    setView({ type: 'workout', id: updated.id })
  }, [])

  const handleDelete = useCallback((id: string) => {
    deleteWorkout(id)
    setWorkouts(loadWorkouts())
    setView({ type: 'calendar' })
  }, [])

  const showAdd = view.type !== 'add' && view.type !== 'edit' && view.type !== 'editDSL'

  return (
    <>
      <nav className="nav">
        <span className="nav-logo" onClick={() => navigate({ type: 'calendar' })}>
          LI<span>FT</span>
        </span>
        {showAdd && (
          <button
            className="btn-icon"
            aria-label="Add workout"
            onClick={() => navigate({ type: 'add' })}
            title="New workout"
          >
            +
          </button>
        )}
      </nav>

      <main className="content">
        {view.type === 'calendar' && (
          <CalendarView workouts={workouts} onNavigate={navigate} />
        )}

        {view.type === 'workout' && (() => {
          const workout = workouts[view.id]
          if (!workout) return (
            <div style={{ padding: '40px 20px', color: 'var(--text-secondary)' }}>
              Workout not found.{' '}
              <button className="btn-ghost" onClick={() => navigate({ type: 'calendar' })}>
                Back
              </button>
            </div>
          )
          return (
            <WorkoutView
              workout={workout}
              onBack={() => navigate({ type: 'calendar' })}
              onEdit={() => navigate({ type: 'edit', id: view.id })}
              onEditDSL={() => navigate({ type: 'editDSL', id: view.id })}
              onDelete={() => handleDelete(view.id)}
            />
          )
        })()}

        {view.type === 'add' && (
          <DSLEditor
            initialRaw={view.prefillDate ? `D: ${view.prefillDate}\n` : ''}
            onSave={handleSave}
            onCancel={() => navigate({ type: 'calendar' })}
          />
        )}

        {view.type === 'editDSL' && (() => {
          const workout = workouts[view.id]
          if (!workout) return null
          return (
            <DSLEditor
              initialRaw={workout.raw}
              onSave={(raw, entry) => {
                const updated: StoredWorkout = { ...workout, raw, entry: { ...entry, raw } }
                saveWorkout(updated)
                setWorkouts(loadWorkouts())
                navigate({ type: 'workout', id: workout.id })
              }}
              onCancel={() => navigate({ type: 'workout', id: view.id })}
            />
          )
        })()}

        {view.type === 'edit' && (() => {
          const workout = workouts[view.id]
          if (!workout) return null
          return (
            <VisualEditor
              workout={workout}
              onSave={handleVisualSave}
              onCancel={() => navigate({ type: 'workout', id: view.id })}
            />
          )
        })()}
      </main>
    </>
  )
}
