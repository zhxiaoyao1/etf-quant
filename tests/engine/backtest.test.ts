import { describe, it, expect } from 'vitest'
import { runBacktest } from '../../src/engine/etf/backtest'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close * 1.01, low: close * 0.99, close, volume: 10000 }
}

function makeSeries(fn: (i: number) => number, n: number): KLine[] {
  const bars: KLine[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(2020, 0, 1)
    d.setDate(d.getDate() + i)
    bars.push(makeBar(d.toISOString().slice(0, 10), fn(i)))
  }
  return bars
}

describe('runBacktest（收盘价 vs MA20）', () => {
  it('returns empty result for insufficient data', () => {
    const bars = makeSeries(() => 10, 15)
    const result = runBacktest(bars)
    expect(result.totalTrades).toBe(0)
  })

  it('does not buy when price stays at/below MA20', () => {
    const bars = makeSeries(() => 10, 60)
    const result = runBacktest(bars)
    expect(result.totalTrades).toBe(0)
  })

  it('buys when price rises above MA20', () => {
    // 横盘后拉升：收盘价上穿 MA20 → 买入并持有
    const bars = makeSeries(i => (i < 40 ? 10 : 10 + (i - 40) * 0.2), 100)
    const result = runBacktest(bars)
    expect(result.totalTrades).toBeGreaterThanOrEqual(1)
    expect(result.equityCurve.length).toBeGreaterThan(0)
    expect(typeof result.sharpeRatio).toBe('number')
    expect(result.maxDrawdown).toBeLessThanOrEqual(0)
  })

  it('sells when price falls below MA20 after a rally', () => {
    // 拉升后回落跌破 MA20 → 卖出，形成完整交易
    const bars = makeSeries(i =>
      i <= 70 ? 10 : (i <= 90 ? 10 + (i - 70) * 0.2 : 14 - (i - 90) * 0.2), 120)
    const result = runBacktest(bars)
    expect(result.totalTrades).toBeGreaterThanOrEqual(1)
    const sellPrices = result.trades.filter(t => t.sellPrice != null).map(t => t.sellPrice!)
    expect(sellPrices.length).toBeGreaterThan(0)
  })

  it('buyAndHoldReturn matches simple price change', () => {
    const bars = makeSeries(i => 10 + i * 0.05, 120)
    const result = runBacktest(bars)
    expect(result.buyAndHoldReturn).toBeGreaterThan(0)
  })
})
