import type { WorkoutEntry, ExerciseEntry, SetEntry } from '../dsl/ast.ts'

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

function measureExerciseCardHeight(ctx: CanvasRenderingContext2D, ex: ExerciseEntry): number {
  // name row + header row + each set row + padding
  const ROW_H = 26
  const NAME_H = 28
  const HEADER_H = 22
  const CARD_PAD = 16
  return CARD_PAD + NAME_H + HEADER_H + ex.sets.length * ROW_H + CARD_PAD
}

function drawExerciseCard(
  ctx: CanvasRenderingContext2D,
  ex: ExerciseEntry,
  x: number,
  y: number,
  w: number,
  labelTag?: string
): number {
  const ROW_H = 26
  const NAME_H = 28
  const HEADER_H = 22
  const CARD_PAD = 16
  const h = measureExerciseCardHeight(ctx, ex)

  // tag label above card (for supersets)
  if (labelTag) {
    ctx.font = '600 10px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = C.accent
    ctx.fillText(labelTag, x + CARD_PAD, y - 6)
  }

  // card background
  roundRect(ctx, x, y, w, h, CARD_RADIUS)
  ctx.fillStyle = C.card
  ctx.fill()
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.stroke()

  let cy = y + CARD_PAD

  // exercise name
  ctx.font = '700 15px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = C.textPrimary
  ctx.fillText(ex.name, x + CARD_PAD, cy + 15)
  cy += NAME_H

  // column headers
  ctx.font = '600 10px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = C.textSecondary
  ctx.fillText('SET', x + CARD_PAD, cy + 11)
  ctx.textAlign = 'center'
  ctx.fillText('REPS', x + w / 2, cy + 11)
  ctx.textAlign = 'right'
  ctx.fillText('WEIGHT', x + w - CARD_PAD, cy + 11)
  ctx.textAlign = 'left'
  cy += HEADER_H

  // set rows
  for (const set of ex.sets) {
    // row divider
    ctx.strokeStyle = C.border
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x + CARD_PAD, cy)
    ctx.lineTo(x + w - CARD_PAD, cy)
    ctx.stroke()

    ctx.font = '400 13px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = C.textSecondary
    ctx.fillText(String(set.setNumber), x + CARD_PAD, cy + 18)

    ctx.fillStyle = C.textPrimary
    ctx.textAlign = 'center'
    ctx.fillText(formatReps(set.reps), x + w / 2, cy + 18)
    ctx.textAlign = 'right'
    ctx.fillText(formatWeight(set.weight), x + w - CARD_PAD, cy + 18)
    ctx.textAlign = 'left'

    cy += ROW_H
  }

  return y + h
}

function renderWorkoutCanvas(entry: WorkoutEntry): HTMLCanvasElement {
  const scale = Math.min(window.devicePixelRatio ?? 1, 2)
  const canvas = document.createElement('canvas')

  // First pass: measure total height
  const measureCtx = canvas.getContext('2d')!
  measureCtx.font = '400 13px system-ui'

  let totalHeight = 80 // header + divider
  if (entry.note) totalHeight += 28
  totalHeight += 16 // gap before first card

  for (const ex of entry.exercises) {
    totalHeight += measureExerciseCardHeight(measureCtx, ex) + 12
  }
  for (const ss of entry.supersets) {
    // "SUPERSET" label
    totalHeight += 20
    for (const ex of ss.exercises) {
      totalHeight += measureExerciseCardHeight(measureCtx, ex) + 8
    }
    totalHeight += 12
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

  // standalone exercises
  for (const ex of entry.exercises) {
    y = drawExerciseCard(ctx, ex, PAD, y, cardW) + 12
  }

  // supersets
  for (const ss of entry.supersets) {
    let firstCard = true
    for (const ex of ss.exercises) {
      const label = firstCard ? 'SUPERSET' : undefined
      y = drawExerciseCard(ctx, ex, PAD, y + (firstCard ? 20 : 0), cardW, label) + 8
      firstCard = false
    }
    y += 12
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
