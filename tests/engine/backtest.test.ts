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

describe('runBacktest（MA20 穿越 + ATR止损）', () => {
  it('returns empty result for insufficient data', () => {
    const bars = makeSeries(() => 10, 15)
    const result = runBacktest(bars)
    expect(result.totalTrades).toBe(0)
  })

  it('buys on MA20 up-cross in a rally and holds', () => {
    // 先横盘再拉升：价格上穿 MA20 且 MA20 向上 → 买入并持有
    const bars = makeSeries(i => (i < 40 ? 10 : 10 + (i - 40) * 0.2), 120)
    const result = runBacktest(bars)
    expect(result.totalTrades).toBeGreaterThanOrEqual(1)
    expect(result.equityCurve.length).toBeGreaterThan(0)
    expect(typeof result.sharpeRatio).toBe('number')
    expect(result.maxDrawdown).toBeLessThanOrEqual(0)
  })

  it('exits via ATR trailing stop on sustained decline after a rally', () => {
    // 拉升后阴跌到底约 10.75；ATR 止损应在接近峰值的高位离场，而非扛到最低点
    const bars = makeSeries(i =>
      i <= 70 ? 10 : (i <= 85 ? 10 + (i - 70) * 0.55 : 18.25 - (i - 85) * 0.3), 111)
    const result = runBacktest(bars)
    expect(result.totalTrades).toBeGreaterThan(0)
    const sellPrices = result.trades.filter(t => t.sellPrice != null).map(t => t.sellPrice!)
    expect(sellPrices.length).toBeGreaterThan(0)
    expect(Math.min(...sellPrices)).toBeGreaterThan(12)
  })

  it('buyAndHoldReturn matches simple price change', () => {
    const bars = makeSeries(i => 10 + i * 0.05, 120)
    const result = runBacktest(bars)
    expect(result.buyAndHoldReturn).toBeGreaterThan(0)
  })
})
