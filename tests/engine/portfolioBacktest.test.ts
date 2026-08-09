import { describe, it, expect } from 'vitest'
import { runPortfolioBacktest } from '../../src/engine/etf/portfolioBacktest'
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

function makeRegime(upFirst: boolean): number[] {
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

describe('runPortfolioBacktest', () => {
  it('portfolio captures up-trends and avoids down-trends (offset regimes)', () => {
    const map = new Map([
      ['A', makeSeries(makeRegime(true))],
      ['B', makeSeries(makeRegime(false))],
    ])
    const result = runPortfolioBacktest(map)
    expect(result.equityCurve.length).toBeGreaterThan(0)
    expect(result.tradeCount).toBeGreaterThan(0)
    // 组合应在强势ETF上持仓、弱势ETF上空仓 → 总收益为正
    expect(result.totalReturn).toBeGreaterThan(0)
    // 无杠杆：收益不会爆炸到天文数字
    expect(result.totalReturn).toBeLessThan(100)
    expect(result.totalReturn).toBeGreaterThan(-1)
    expect(typeof result.sharpeRatio).toBe('number')
    expect(result.maxDrawdown).toBeLessThanOrEqual(0)
  })

  it('returns empty for insufficient pool', () => {
    const result = runPortfolioBacktest(new Map([['A', makeSeries(makeRegime(true))]]))
    expect(result.equityCurve).toHaveLength(0)
  })
})
