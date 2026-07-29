import type { WorkoutEntry, ExerciseEntry, SetEntry, SupersetEntry, WorkoutItem } from '../dsl/ast.ts'

function orderedItems(entry: WorkoutEntry): WorkoutItem[] {
  return entry.items ?? [
    ...entry.exercises.map((exercise) => ({ kind: 'exercise' as const, exercise })),
    ...entry.supersets.map((superset) => ({ kind: 'superset' as const, superset })),
  ]
}

// ---------- URL encode / decode ----------

export function encodeWorkoutLink(raw: string): string {
  const b64 = btoa(unescape(encodeURIComponent(raw)))
  return `${window.location.origin}${window.location.pathname}?w=${b64}`
}

export function decodeWorkoutLink(encoded: string): string {
  return decodeURIComponent(escape(atob(encoded)))
}

// ---------- Canvas rendering ----------

const W = 480
const PAD = 24
const CARD_RADIUS = 8

const C = {
  bg: '#0f0f0f',
  card: '#1e1e1e',
  border: '#2e2e2e',
  textPrimary: '#f0f0f0',
  textSecondary: '#888888',
  accent: '#f97316',
  footer: '#555555',
}

function formatReps(reps: SetEntry['reps']): string {
  return typeof reps === 'number' ? String(reps) : `${reps.seconds}s`
}

function formatWeight(weight: SetEntry['weight']): string {
  return weight.value === 0 ? '—' : `${weight.value} ${weight.unit}`
}

function repsEqual(a: SetEntry['reps'], b: SetEntry['reps']): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b
  return a.seconds === b.seconds
}

function weightEqual(a: SetEntry['weight'], b: SetEntry['weight']): boolean {
  return a.value === b.value && a.unit === b.unit
}

// A row to render in the shared-image set table: either one real set, or a
// single summary row standing in for several identical sets (e.g. a plain
// "3x8 @ 135lbs" collapses to one "3×" row instead of three near-duplicate
// ones). The in-app view always lists every set individually — this
// collapsing is share-image-only.
type DisplayRow = {
  label: string
  reps: SetEntry['reps']
  weight: SetEntry['weight']
}

function getDisplayRows(ex: ExerciseEntry): DisplayRow[] {
  const sets = ex.sets
  if (sets.length > 1) {
    const first = sets[0]
    const uniform = sets.every(
      (s) => repsEqual(s.reps, first.reps) && weightEqual(s.weight, first.weight)
    )
    if (uniform) {
      return [{ label: `${sets.length}×`, reps: first.reps, weight: first.weight }]
    }
  }
  return sets.map((s) => ({ label: String(s.setNumber), reps: s.reps, weight: s.weight }))
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const mm = parseInt(parts[0], 10) - 1
  const dd = parseInt(parts[1], 10)
  const yy = parseInt(parts[2], 10)
  const year = yy < 70 ? 2000 + yy : 1900 + yy
  return `${months[mm] ?? parts[0]} ${dd}, ${year}`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

const ROW_H = 26
const NAME_H = 28
const HEADER_H = 22
const CARD_PAD = 16
const PILL_H = 22
const PILL_GAP = 14
const EXERCISE_GAP = 20

function measureExerciseContentHeight(ex: ExerciseEntry): number {
  return NAME_H + HEADER_H + getDisplayRows(ex).length * ROW_H
}

function measureExerciseCardHeight(ex: ExerciseEntry): number {
  return CARD_PAD * 2 + measureExerciseContentHeight(ex)
}

function measureSupersetCardHeight(ss: SupersetEntry): number {
  let h = CARD_PAD * 2 + PILL_H + PILL_GAP
  ss.exercises.forEach((ex, i) => {
    h += measureExerciseContentHeight(ex)
    if (i < ss.exercises.length - 1) h += EXERCISE_GAP
  })
  return h
}

// Draws an exercise's name + set table starting at (x, y) within a content
// area of width w. Returns the y position immediately below the content.
function drawExerciseContent(
  ctx: CanvasRenderingContext2D,
  ex: ExerciseEntry,
  x: number,
  y: number,
  w: number,
  style: 'standalone' | 'superset'
): number {
  let cy = y

  // exercise name
  if (style === 'standalone') {
    ctx.font = '700 15px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = C.textPrimary
    ctx.fillText(ex.name, x, cy + 15)
  } else {
    ctx.font = '600 13px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = C.textSecondary
    ctx.fillText(ex.name.toUpperCase(), x, cy + 13)
  }
  cy += NAME_H

  // column headers
  ctx.font = '600 10px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = C.textSecondary
  ctx.fillText('SET', x, cy + 11)
  ctx.textAlign = 'center'
  ctx.fillText('REPS', x + w / 2, cy + 11)
  ctx.textAlign = 'right'
  ctx.fillText('WEIGHT', x + w, cy + 11)
  ctx.textAlign = 'left'
  cy += HEADER_H

  // set rows (collapsed to one summary row when every set is identical)
  for (const row of getDisplayRows(ex)) {
    // row divider
    ctx.strokeStyle = C.border
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x, cy)
    ctx.lineTo(x + w, cy)
    ctx.stroke()

    ctx.font = '400 13px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = C.textSecondary
    ctx.fillText(row.label, x, cy + 18)

    ctx.fillStyle = C.textPrimary
    ctx.textAlign = 'center'
    ctx.fillText(formatReps(row.reps), x + w / 2, cy + 18)
    ctx.textAlign = 'right'
    ctx.fillText(formatWeight(row.weight), x + w, cy + 18)
    ctx.textAlign = 'left'

    cy += ROW_H
  }

  return cy
}

// Draws a pill-shaped label badge with its top-left at (x, y). Returns the
// pill's width so callers can lay out anything that follows it on the line.
function drawPill(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): number {
  ctx.font = '700 10px system-ui, -apple-system, sans-serif'
  const padX = 8
  const w = ctx.measureText(label).width + padX * 2

  roundRect(ctx, x, y, w, PILL_H, PILL_H / 2)
  ctx.fillStyle = 'rgba(249, 115, 22, 0.12)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.25)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = C.accent
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + padX, y + PILL_H / 2 + 1)
  ctx.textBaseline = 'alphabetic'

  return w
}

function drawExerciseCard(
  ctx: CanvasRenderingContext2D,
  ex: ExerciseEntry,
  x: number,
  y: number,
  w: number
): number {
  const h = measureExerciseCardHeight(ex)

  roundRect(ctx, x, y, w, h, CARD_RADIUS)
  ctx.fillStyle = C.card
  ctx.fill()
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.stroke()

  drawExerciseContent(ctx, ex, x + CARD_PAD, y + CARD_PAD, w - CARD_PAD * 2, 'standalone')

  return y + h
}

// Draws all exercises in a superset inside a single enclosing card, mirroring
// how the in-app view groups them (one card, one SUPERSET badge, exercises
// stacked inside) instead of one card per exercise.
function drawSupersetCard(
  ctx: CanvasRenderingContext2D,
  ss: SupersetEntry,
  x: number,
  y: number,
  w: number
): number {
  const h = measureSupersetCardHeight(ss)

  roundRect(ctx, x, y, w, h, CARD_RADIUS)
  ctx.fillStyle = C.card
  ctx.fill()
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.stroke()

  const contentX = x + CARD_PAD
  const contentW = w - CARD_PAD * 2
  let cy = y + CARD_PAD

  drawPill(ctx, 'SUPERSET', contentX, cy)
  cy += PILL_H + PILL_GAP

  ss.exercises.forEach((ex, i) => {
    cy = drawExerciseContent(ctx, ex, contentX, cy, contentW, 'superset')
    if (i < ss.exercises.length - 1) cy += EXERCISE_GAP
  })

  return y + h
}

function renderWorkoutCanvas(entry: WorkoutEntry): HTMLCanvasElement {
  const scale = Math.min(window.devicePixelRatio ?? 1, 2)
  const canvas = document.createElement('canvas')

  // First pass: measure total height
  let totalHeight = 80 // header + divider
  if (entry.note) totalHeight += 28
  totalHeight += 16 // gap before first card

  for (const item of orderedItems(entry)) {
    totalHeight += item.kind === 'exercise'
      ? measureExerciseCardHeight(item.exercise) + 12
      : measureSupersetCardHeight(item.superset) + 12
  }
  totalHeight += 40 // footer

  const H = Math.max(totalHeight, 200)
  canvas.width = W * scale
  canvas.height = H * scale

  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // background
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)

  // header: logo + date
  const logoY = 42
  ctx.font = '700 22px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = C.textPrimary
  ctx.fillText('LI', PAD, logoY)
  const liWidth = ctx.measureText('LI').width
  ctx.fillStyle = C.accent
  ctx.fillText('FT', PAD + liWidth, logoY)

  const dateStr = formatDate(entry.date)
  if (dateStr) {
    ctx.font = '400 14px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = C.textSecondary
    ctx.textAlign = 'right'
    ctx.fillText(dateStr, W - PAD, logoY)
    ctx.textAlign = 'left'
  }

  // divider
  const divY = logoY + 14
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, divY)
  ctx.lineTo(W - PAD, divY)
  ctx.stroke()

  let y = divY + 20

  // note
  if (entry.note) {
    ctx.font = 'italic 13px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = C.textSecondary
    ctx.fillText(entry.note, PAD, y + 12)
    y += 28
  }

  const cardW = W - PAD * 2

  // exercises and supersets, in source order
  for (const item of orderedItems(entry)) {
    y = item.kind === 'exercise'
      ? drawExerciseCard(ctx, item.exercise, PAD, y, cardW) + 12
      : drawSupersetCard(ctx, item.superset, PAD, y, cardW) + 12
  }

  // footer
  ctx.font = '400 11px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = C.footer
  ctx.textAlign = 'center'
  ctx.fillText('made with LIFT', W / 2, H - 16)
  ctx.textAlign = 'left'

  return canvas
}

// ---------- Share / download ----------

export async function shareOrDownloadWorkout(entry: WorkoutEntry): Promise<void> {
  const canvas = renderWorkoutCanvas(entry)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) {
    console.warn('shareOrDownloadWorkout: canvas.toBlob returned null')
    return
  }

  const filename = entry.date
    ? `workout-${entry.date.replace(/\//g, '-')}.png`
    : 'workout.png'
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Workout' })
    return
  }

  // desktop fallback: download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
