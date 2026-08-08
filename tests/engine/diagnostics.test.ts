import { describe, it, expect } from 'vitest'
import { runDiagnostics } from '../../src/engine/etf/diagnostics'
import { etfFactors } from '../../src/factors/etf'
import type { KLine } from '../../src/types'

const WEIGHTS = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close * 1.01, low: close * 0.99, close, volume: 1000 }
}

function series(prices: number[]): KLine[] {
  return prices.map((p, i) => {
    const d = new Date(2020, 0, 1)
    d.setDate(d.getDate() + i)
    return makeBar(d.toISOString().slice(0, 10), p)
  })
}

// 确定性伪随机（LCG），避免测试flaky
function makeRandomWalk(n: number, seed = 42): number[] {
  let s = seed
  const prices = [10]
  for (let i = 1; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    const r = s / 2147483648
    prices.push(prices[i - 1] * (1 + (r - 0.5) * 0.04))
  }
  return prices
}

describe('runDiagnostics', () => {
  it('detects positive IC when scores predict forward returns (regime series)', () => {
    // 交替 50 根上涨/50 根下跌的强趋势分段：高分对应未来上涨
    const prices: number[] = []
    for (let seg = 0; seg < 4; seg++) {
      const up = seg % 2 === 0
      const base = up ? 10 : 15
      const dir = up ? 0.1 : -0.1
      for (let i = 0; i < 50; i++) prices.push(base + i * dir)
    }
    const result = runDiagnostics(series(prices), etfFactors, WEIGHTS, 5)
    expect(result.factors.length).toBe(4)
    expect(result.compositeIC).toBeGreaterThan(0.2)
    for (const f of result.factors) {
      expect(f.sampleCount).toBeGreaterThan(10)
      expect(f.ic).toBeGreaterThan(0)
    }
  })

  it('reports near-zero IC on noise (honest no-signal case)', () => {
    const result = runDiagnostics(series(makeRandomWalk(300)), etfFactors, WEIGHTS, 5)
    expect(result.compositeIC).toBeGreaterThan(-0.3)
    expect(result.compositeIC).toBeLessThan(0.3)
  })

  it('returns empty for insufficient data', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 10 + i * 0.1)
    const result = runDiagnostics(series(prices), etfFactors, WEIGHTS, 5)
    expect(result.factors).toHaveLength(0)
  })
})
