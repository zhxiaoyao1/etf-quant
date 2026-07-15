import { describe, it, expect } from 'vitest'
import { momentumFactor } from '../../src/factors/etf/momentum'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number, high = close, low = close): KLine {
  return { date, open: close, high, low, close, volume: 1000 }
}

describe('momentumFactor', () => {
  it('returns high score when RSI is oversold (30-50)', () => {
    const bars: KLine[] = []
    let price = 25.0
    for (let i = 0; i < 50; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      // Alternate losses (-0.3) and gains (+0.2) to produce RSI ~40
      if (i % 2 === 0) {
        price -= 0.3
      } else {
        price += 0.2
      }
      bars.push(makeBar(d.toISOString().slice(0, 10), price))
    }
    const score = momentumFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(50)
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + Math.sin(i * 0.5) * 3))
    }
    const score = momentumFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
