import { describe, it, expect } from 'vitest'
import { runBacktest } from '../../src/engine/etf/backtest'
import type { KLine } from '../../src/types'

function makeBar(date: string, open: number, close: number): KLine {
  return { date, open, high: Math.max(open, close) * 1.01, low: Math.min(open, close) * 0.99, close, volume: 10000 }
}

describe('runBacktest', () => {
  it('returns empty result for insufficient data', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 50; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10, 10))
    }
    const result = runBacktest(bars, { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 })
    expect(result.totalTrades).toBe(0)
  })

  it('generates trades on a strong trending market', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 200; i++) {
      const d = new Date(2020, 0, 1)
      d.setDate(d.getDate() + i)
      const price = 10 + i * 0.1 + Math.sin(i * 0.1) * 2
      bars.push(makeBar(d.toISOString().slice(0, 10), price * 0.99, price))
    }
    const result = runBacktest(bars, { trend: 0.4, momentum: 0.2, volatility: 0.2, moneyFlow: 0.2 }, { buyThreshold: 60, sellThreshold: 30 })
    expect(result.totalTrades).toBeGreaterThan(0)
    expect(result.equityCurve.length).toBeGreaterThan(0)
    expect(typeof result.sharpeRatio).toBe('number')
    expect(typeof result.maxDrawdown).toBe('number')
    expect(result.maxDrawdown).toBeLessThanOrEqual(0)
  })

  it('buyAndHoldReturn matches simple price change', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 200; i++) {
      const d = new Date(2020, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10, 10 + i * 0.05))
    }
    const result = runBacktest(bars, { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 })
    // Buy & hold should be positive since price trends up
    expect(result.buyAndHoldReturn).toBeGreaterThan(0)
  })

  it('exits via ATR trailing stop on sustained decline after a rally', () => {
    // 拉升后阴跌到底约 10.75；ATR 移动止损应在接近峰值的高位离场，而非扛到最低点
    const bars: KLine[] = []
    for (let i = 0; i < 111; i++) {
      const d = new Date(2020, 0, 1)
      d.setDate(d.getDate() + i)
      const price = i <= 70 ? 10 : (i <= 85 ? 10 + (i - 70) * 0.55 : 18.25 - (i - 85) * 0.3)
      bars.push({ date: d.toISOString().slice(0, 10), open: price, high: price * 1.01, low: price * 0.99, close: price, volume: 1000 })
    }
    const result = runBacktest(bars, { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 })
    expect(result.totalTrades).toBeGreaterThan(0)
    const sellPrices = result.trades.filter(t => t.sellPrice != null).map(t => t.sellPrice!)
    expect(sellPrices.length).toBeGreaterThan(0)
    expect(Math.min(...sellPrices)).toBeGreaterThan(12)
  })
})
