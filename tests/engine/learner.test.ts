import { describe, it, expect } from 'vitest'
import { adjustWeights } from '../../src/engine/etf/learner'
import type { Signal } from '../../src/types'

describe('adjustWeights', () => {
  it('adjusts weights based on factor accuracy', () => {
    const signals: Signal[] = [
      {
        id: 's1', etfCode: '510300', date: '2026-06-01',
        compositeScore: 75, signal: 'hold',
        factorScores: [
          { factorId: 'trend', name: '趋势', score: 80 },
          { factorId: 'momentum', name: '动量', score: 60 },
        ],
        weights: { trend: 0.5, momentum: 0.5 },
      },
      {
        id: 's2', etfCode: '510300', date: '2026-06-02',
        compositeScore: 60, signal: 'hold',
        factorScores: [
          { factorId: 'trend', name: '趋势', score: 40 },
          { factorId: 'momentum', name: '动量', score: 80 },
        ],
        weights: { trend: 0.5, momentum: 0.5 },
      },
    ]

    const oldWeights = { trend: 0.5, momentum: 0.5 }
    const result = adjustWeights(signals, 'up', oldWeights, {
      learningRate: 1.0,
      lookbackWindow: 20,
      minSamples: 1,
      weightMin: 0.1,
      weightMax: 0.9,
    })

    expect(result.newWeights.momentum).toBeGreaterThan(result.newWeights.trend)
    expect(result.factorAccuracies.momentum).toBeGreaterThan(result.factorAccuracies.trend)
  })

  it('returns old weights when not enough samples', () => {
    const oldWeights = { trend: 0.5, momentum: 0.5 }
    const result = adjustWeights([], 'up', oldWeights, {
      learningRate: 0.3,
      lookbackWindow: 20,
      minSamples: 10,
      weightMin: 0.1,
      weightMax: 0.5,
    })
    expect(result.newWeights).toEqual(oldWeights)
  })

  it('clamps weights to min/max bounds', () => {
    const signals: Signal[] = []
    for (let i = 0; i < 20; i++) {
      signals.push({
        id: `s${i}`, etfCode: '510300', date: `2026-06-${String(i + 1).padStart(2, '0')}`,
        compositeScore: 60, signal: 'hold',
        factorScores: [
          { factorId: 'trend', name: '趋势', score: 80 },
          { factorId: 'momentum', name: '动量', score: 20 },
        ],
        weights: { trend: 0.5, momentum: 0.5 },
      })
    }

    const result = adjustWeights(signals, 'up', { trend: 0.9, momentum: 0.1 }, {
      learningRate: 1.0,
      lookbackWindow: 20,
      minSamples: 1,
      weightMin: 0.1,
      weightMax: 0.5,
    })

    expect(result.newWeights.trend).toBeGreaterThan(result.newWeights.momentum)
    expect(result.newWeights.momentum).toBeGreaterThanOrEqual(0.1)
    expect(result.newWeights.trend).toBeLessThanOrEqual(0.9)
    const totalWeight = Object.values(result.newWeights).reduce((s, w) => s + w, 0)
    expect(totalWeight).toBeCloseTo(1.0, 2)
  })
})
