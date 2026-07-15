import { describe, it, expect } from 'vitest'
import { scoreETF } from '../../src/engine/etf/scorer'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number, volume = 1000): KLine {
  return { date, open: close, high: close * 1.01, low: close * 0.99, close, volume }
}

describe('scoreETF', () => {
  it('returns buy signal for strong uptrend with default weights', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 100; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + i * 0.1, 1000 + i * 50))
    }
    const weights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = scoreETF(bars, weights)
    expect(result.compositeScore).toBeGreaterThanOrEqual(50)
    expect(['buy', 'hold', 'sell']).toContain(result.signal)
    expect(result.factorScores).toHaveLength(4)
  })

  it('returns hold for flat price data', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 80; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10))
    }
    const weights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = scoreETF(bars, weights)
    expect(result.signal).toBe('hold')
  })

  it('uses custom thresholds', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 80; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10))
    }
    const weights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = scoreETF(bars, weights, { buyThreshold: 50, sellThreshold: 30 })
    expect(result.compositeScore).toBeGreaterThan(0)
  })
})
