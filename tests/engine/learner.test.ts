import { describe, it, expect } from 'vitest'
import { learnFromHistory } from '../../src/engine/etf/learner'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close, low: close, close, volume: 1000 }
}

describe('learnFromHistory', () => {
  it('returns new weights different from old when factors disagree', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 200; i++) {
      const d = new Date(2020, 0, 1)
      d.setDate(d.getDate() + i)
      // Strong uptrend - trend factor should dominate
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + i * 0.1))
    }
    const oldWeights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = learnFromHistory(bars, oldWeights, { learningRate: 1.0, lookbackWindow: 20, minSamples: 10, weightMin: 0.1, weightMax: 0.5 }, 5)
    expect(result.sampleCount).toBeGreaterThan(10)
    // In a strong uptrend, trend should be the most accurate
    expect(result.factorAccuracies.trend).toBeDefined()
    expect(result.factorAccuracies.momentum).toBeDefined()
    // New weights should differ from old
    const allSame = Object.keys(oldWeights).every(k => result.newWeights[k] === oldWeights[k])
    expect(allSame).toBe(false)
  })

  it('returns old weights when insufficient data', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 50; i++) {
      const d = new Date(2020, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10))
    }
    const oldWeights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = learnFromHistory(bars, oldWeights)
    expect(result.sampleCount).toBe(0)
    expect(result.newWeights).toEqual(oldWeights)
  })
})
