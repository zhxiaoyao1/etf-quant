import { describe, it, expect } from 'vitest'
import { learnFromHistory } from '../../src/engine/etf/learner'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close, low: close, close, volume: 1000 }
}

describe('learnFromHistory', () => {
  it('computes normalized weights within bounds on sufficient data', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 200; i++) {
      const d = new Date(2020, 0, 1)
      d.setDate(d.getDate() + i)
      // 强上升趋势：统一趋势/动量哲学下所有因子同向，权重应保持均衡
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + i * 0.1))
    }
    const oldWeights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = learnFromHistory(bars, oldWeights, { learningRate: 1.0, lookbackWindow: 20, minSamples: 10, weightMin: 0.1, weightMax: 0.5 }, 5)
    expect(result.sampleCount).toBeGreaterThan(10)
    for (const id of ['trend', 'momentum', 'volatility', 'moneyFlow']) {
      expect(result.factorAccuracies[id]).toBeDefined()
      expect(result.newWeights[id]).toBeGreaterThanOrEqual(0.1)
      expect(result.newWeights[id]).toBeLessThanOrEqual(0.5)
    }
    const sum = Object.values(result.newWeights).reduce((s, w) => s + w, 0)
    expect(sum).toBeCloseTo(1, 2)
  })

  it('shifts weights when factor accuracies differ (choppy market)', () => {
    // 震荡市：因子对方向判断的准确率不一致，权重应被重分配
    const bars: KLine[] = []
    for (let i = 0; i < 200; i++) {
      const d = new Date(2020, 0, 1)
      d.setDate(d.getDate() + i)
      const cycle = Math.sin(i * 0.2) * 3
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + cycle))
    }
    const oldWeights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = learnFromHistory(bars, oldWeights, { learningRate: 1.0, lookbackWindow: 20, minSamples: 10, weightMin: 0.1, weightMax: 0.5 }, 5)
    expect(result.sampleCount).toBeGreaterThan(10)
    // 至少有一个因子的权重偏离默认 0.25（准确率不同 → 重分配）
    const hasShift = Object.values(result.newWeights).some(w => Math.abs(w - 0.25) > 0.02)
    expect(hasShift).toBe(true)
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
