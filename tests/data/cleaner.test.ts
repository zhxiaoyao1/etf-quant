import { describe, it, expect } from 'vitest'
import { cleanKLines, removeDuplicates, fillMissingDates } from '../../src/data/cleaner'
import type { KLine } from '../../src/types'

describe('cleanKLines', () => {
  it('removes bars with invalid OHLCV', () => {
    const bars: KLine[] = [
      { date: '2026-07-10', open: 0, high: 1, low: 1, close: 1, volume: 100 },
      { date: '2026-07-11', open: 1, high: 1, low: 1, close: 1, volume: -1 },
      { date: '2026-07-12', open: 1, high: 2, low: 0.5, close: 1.5, volume: 200 },
    ]
    const result = cleanKLines(bars)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-07-12')
  })

  it('sorts by date ascending', () => {
    const bars: KLine[] = [
      { date: '2026-07-12', open: 1, high: 2, low: 1, close: 1.5, volume: 200 },
      { date: '2026-07-10', open: 1, high: 2, low: 1, close: 1.5, volume: 200 },
    ]
    const result = cleanKLines(bars)
    expect(result[0].date).toBe('2026-07-10')
    expect(result[1].date).toBe('2026-07-12')
  })
})

describe('removeDuplicates', () => {
  it('keeps only the first occurrence of each date', () => {
    const bars: KLine[] = [
      { date: '2026-07-10', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
      { date: '2026-07-10', open: 2, high: 3, low: 2, close: 2.5, volume: 200 },
      { date: '2026-07-11', open: 1, high: 2, low: 1, close: 1.5, volume: 150 },
    ]
    const result = removeDuplicates(bars)
    expect(result).toHaveLength(2)
    expect(result[0].open).toBe(1)
  })
})

describe('fillMissingDates', () => {
  it('does not modify complete daily data', () => {
    const bars: KLine[] = [
      { date: '2026-07-10', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
      { date: '2026-07-13', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
    ]
    const result = fillMissingDates(bars)
    expect(result).toHaveLength(2)
  })
})
