import { describe, it, expect } from 'vitest'
import { trendFactor } from '../../src/factors/etf/trend'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close, low: close, close, volume: 1000 }
}

describe('trendFactor', () => {
  it('returns high score for uptrend (MA5 > MA20 > MA60)', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 100; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 3 + i * 0.05))
    }
    const score = trendFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(70)
  })

  it('returns low score for downtrend (MA5 < MA20 < MA60)', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 100; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 - i * 0.05))
    }
    const score = trendFactor.calculate(bars)
    expect(score).toBeLessThanOrEqual(30)
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 60; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 5 + Math.sin(i * 0.3) * 2))
    }
    const score = trendFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
