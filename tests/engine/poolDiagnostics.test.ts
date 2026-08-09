import { describe, it, expect } from 'vitest'
import { runPoolDiagnostics } from '../../src/engine/etf/poolDiagnostics'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close * 1.01, low: close * 0.99, close, volume: 1000 }
}

function makeSeries(closes: number[]): KLine[] {
  return closes.map((c, i) => {
    const d = new Date(2020, 0, 1)
    d.setDate(d.getDate() + i)
    return makeBar(d.toISOString().slice(0, 10), c)
  })
}

// 确定性伪随机游走
function randomWalk(n: number, seed: number): number[] {
  let s = seed
  const prices = [10]
  for (let i = 1; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    const r = s / 2147483648
    prices.push(prices[i - 1] * (1 + (r - 0.5) * 0.04))
  }
  return prices
}

describe('runPoolDiagnostics', () => {
  it('detects positive IC when scores predict forward returns (offset regimes)', () => {
    // 两只ETF走势相反：任何时刻一只强一只弱，分数应预示未来收益
    const makeRegime = (upFirst: boolean): number[] => {
      const out: number[] = []
      for (let seg = 0; seg < 3; seg++) {
        const up = seg % 2 === 0 ? upFirst : !upFirst
        for (let i = 0; i < 40; i++) {
          const base = out.length > 0 ? out[out.length - 1] : 10
          out.push(up ? base * 1.01 : base * 0.99)
        }
      }
      return out
    }
    const map = new Map([
      ['A', makeSeries(makeRegime(true))],
      ['B', makeSeries(makeRegime(false))],
    ])
    const result = runPoolDiagnostics(map, 5)
    expect(result.factors.length).toBe(5)
    const total = result.factors.find(f => f.factor === 'total')!
    const momentum = result.factors.find(f => f.factor === 'momentum')!
    expect(total.sampleCount).toBeGreaterThan(100)
    expect(momentum.ic).toBeGreaterThan(0.1)
    expect(total.ic).toBeGreaterThan(0.05)
  })

  it('reports near-zero IC on noise', () => {
    const map = new Map([
      ['A', makeSeries(randomWalk(200, 1))],
      ['B', makeSeries(randomWalk(200, 2))],
    ])
    const result = runPoolDiagnostics(map, 5)
    const total = result.factors.find(f => f.factor === 'total')!
    expect(Math.abs(total.ic)).toBeLessThan(0.3)
  })
})
