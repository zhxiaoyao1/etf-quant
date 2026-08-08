import { describe, it, expect } from 'vitest'
import { momentumFactor } from '../../src/factors/etf/momentum'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close, low: close, close, volume: 1000 }
}

describe('momentumFactor', () => {
  it('returns high score for rising price (true momentum)', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 70; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + i * 0.1))
    }
    const score = momentumFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(70)
  })

  it('returns low score for falling price', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 70; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 20 - i * 0.1))
    }
    const score = momentumFactor.calculate(bars)
    expect(score).toBeLessThanOrEqual(40)
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 70; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + Math.sin(i * 0.5) * 3))
    }
    const score = momentumFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
