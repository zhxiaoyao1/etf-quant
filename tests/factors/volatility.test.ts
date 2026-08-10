import { describe, it, expect } from 'vitest'
import { volatilityFactor } from '../../src/factors/etf/volatility'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close * 1.02, low: close * 0.98, close, volume: 1000 }
}

describe('volatilityFactor', () => {
  it('returns high score when price near lower Bollinger band', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 20 - i * 0.3))
    }
    const score = volatilityFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(50)
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + Math.sin(i * 0.3) * 3))
    }
    const score = volatilityFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
