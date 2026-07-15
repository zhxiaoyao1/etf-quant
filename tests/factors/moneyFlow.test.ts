import { describe, it, expect } from 'vitest'
import { moneyFlowFactor } from '../../src/factors/etf/moneyFlow'
import type { KLine } from '../../src/types'

describe('moneyFlowFactor', () => {
  it('returns high score on volume-backed price rise', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push({
        date: d.toISOString().slice(0, 10),
        open: 10 + i * 0.1,
        high: 10 + i * 0.15,
        low: 10 + i * 0.05,
        close: 10 + i * 0.12,
        volume: 1000 + i * 100,
      })
    }
    const score = moneyFlowFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(60)
  })

  it('returns low score on volume-backed price drop', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push({
        date: d.toISOString().slice(0, 10),
        open: 20 - i * 0.1,
        high: 20 - i * 0.05,
        low: 20 - i * 0.15,
        close: 20 - i * 0.12,
        volume: 1000 + i * 100,
      })
    }
    const score = moneyFlowFactor.calculate(bars)
    expect(score).toBeLessThanOrEqual(40)
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push({
        date: d.toISOString().slice(0, 10),
        open: 10 + Math.sin(i * 0.5) * 2,
        high: 10 + Math.sin(i * 0.5) * 2 + 0.3,
        low: 10 + Math.sin(i * 0.5) * 2 - 0.3,
        close: 10 + Math.sin(i * 0.5) * 2 + 0.1,
        volume: 500 + Math.floor(Math.random() * 500),
      })
    }
    const score = moneyFlowFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
