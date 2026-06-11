import { describe, it, expect } from 'vitest'
import { parseWorkout } from '../../dsl/parser'
import { serialize } from '../../dsl/serializer'

/** Parse → serialize → re-parse and compare entries (ignoring raw). */
function roundTrip(src: string) {
  const first = parseWorkout(src).entry
  const reserialized = serialize(first)
  const second = parseWorkout(reserialized).entry
  // Compare structural fields, not raw (which will differ in formatting)
  return {
    first: { date: first.date, note: first.note, exercises: first.exercises, supersets: first.supersets },
    second: { date: second.date, note: second.note, exercises: second.exercises, supersets: second.supersets },
    reserialized,
  }
}

describe('serialize', () => {
  it('uniform reps and weight', () => {
    const { first, second } = roundTrip('D: 06/11/25\nSquat 3x5 @ 185lbs')
    expect(second).toEqual(first)
  })

  it('variable reps', () => {
    const { first, second } = roundTrip('OHP 3x[5,3,1] @ 95lbs')
    expect(second).toEqual(first)
  })

  it('variable weights', () => {
    const { first, second } = roundTrip('Squat 4x5 @ [135,155,175,185]lbs')
    expect(second).toEqual(first)
  })

  it('timed sets', () => {
    const { first, second } = roundTrip('Plank 3x45sec')
    expect(second).toEqual(first)
  })

  it('kg unit', () => {
    const { first, second } = roundTrip('Front Squat 3x3 @ 100kg')
    expect(second).toEqual(first)
  })

  it('decimal weights', () => {
    const { first, second } = roundTrip('Curls 3x10 @ 22.5kg')
    expect(second).toEqual(first)
  })

  it('no weight (defaults to 0)', () => {
    const { first, second } = roundTrip('Pull Ups 3x8')
    expect(second).toEqual(first)
  })

  it('superset', () => {
    const { first, second } = roundTrip(
      'S: Curls 3x10 @ 50lbs, Skull crushers 3x10 @ 60lbs'
    )
    expect(second).toEqual(first)
  })

  it('note is preserved', () => {
    const { second } = roundTrip('D: 06/11/25\nN: Felt strong today\nBench 3x5 @ 185')
    expect(second.note).toBe('Felt strong today')
  })

  it('full session round-trips cleanly', () => {
    const src = [
      'D: 05/30/25',
      'Front Squat 4x5 @ [100,110,120,120]lbs',
      'BB RDL 3x6 @ [70,90,100]lbs',
      'Broad Jump 3x3',
      'S: Curls 3x[10,8,6] @ [40,45,50]lbs, Skull crushers 3x10 @ 60lbs',
    ].join('\n')
    const { first, second } = roundTrip(src)
    expect(second).toEqual(first)
  })
})
