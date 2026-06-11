import React, { useState, useMemo } from 'react'
import type { StoredWorkout, View } from '../types.ts'
import DataToolbar from './DataToolbar.tsx'

interface Props {
  workouts: Record<string, StoredWorkout>
  onNavigate: (view: View) => void
  onImported: () => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Zero-pad a number to 2 digits */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Format a Date as MM/DD/YY */
function toMMDDYY(date: Date): string {
  const mm = pad2(date.getMonth() + 1)
  const dd = pad2(date.getDate())
  const yy = String(date.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
}

export default function CalendarView({ workouts, onNavigate, onImported }: Props) {
  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-based

  // Build lookup map: 'MM/DD/YY' -> StoredWorkout
  const workoutMap = useMemo(() => {
    const map: Record<string, StoredWorkout> = {}
    for (const w of Object.values(workouts)) {
      if (w.entry.date) {
        map[w.entry.date] = w
      }
    }
    return map
  }, [workouts])

  // Build the 6x7 calendar grid
  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay() // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const cells: Array<{ date: Date; isCurrentMonth: boolean }> = []

    // Fill leading days from prev month
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), isCurrentMonth: true })
    }

    // Fill trailing days from next month
    const remaining = 42 - cells.length // 6 rows × 7 cols
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false })
    }

    return cells
  }, [year, month])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  function isToday(date: Date): boolean {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  function handleDayClick(date: Date, isCurrentMonth: boolean) {
    if (!isCurrentMonth) return
    const key = toMMDDYY(date)
    const workout = workoutMap[key]
    if (workout) {
      onNavigate({ type: 'workout', id: workout.id })
    } else {
      onNavigate({ type: 'add', prefillDate: key })
    }
  }

  return (
    <div className="calendar-wrap">
      <div className="calendar-header">
        <div className="calendar-title">
          {MONTHS[month]} {year}
        </div>
        <div className="calendar-header-controls">
          <button className="btn-today" onClick={goToday}>Today</button>
          <button className="btn-chevron" aria-label="Previous month" onClick={prevMonth}>
            ‹
          </button>
          <button className="btn-chevron" aria-label="Next month" onClick={nextMonth}>
            ›
          </button>
        </div>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="calendar-weekday">{wd}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {days.map(({ date, isCurrentMonth }, i) => {
          const key = toMMDDYY(date)
          const hasWorkout = !!workoutMap[key]
          const todayClass = isCurrentMonth && isToday(date) ? ' today' : ''
          const outsideClass = !isCurrentMonth ? ' outside' : ''

          return (
            <div
              key={i}
              className={`calendar-day${todayClass}${outsideClass}`}
              onClick={() => handleDayClick(date, isCurrentMonth)}
              role="button"
              aria-label={`${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}${hasWorkout ? ' — has workout' : ''}`}
            >
              <span className="calendar-day-num">{date.getDate()}</span>
              {isCurrentMonth && hasWorkout && (
                <span className="calendar-dot" aria-hidden="true" />
              )}
            </div>
          )
        })}
      </div>
      <DataToolbar onImported={onImported} />
    </div>
  )
}
