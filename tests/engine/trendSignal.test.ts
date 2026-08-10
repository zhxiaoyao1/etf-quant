import { describe, it, expect } from 'vitest'
import { computeTrendSignal, computeRegime, computeDualSignal } from '../../src/engine/etf/trendSignal'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close, low: close, close, volume: 1000 }
}

function makeSeries(fn: (i: number) => number, n: number): KLine[] {
  const bars: KLine[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(2026, 0, 1)
    d.setDate(d.getDate() + i)
    bars.push(makeBar(d.toISOString().slice(0, 10), fn(i)))
  }
  return bars
}

describe('computeTrendSignal（纯收盘价 vs MA20）', () => {
  it('scores buy when close above MA20', () => {
    // 横盘后拉升，收盘明显高于 MA20
    const bars = makeSeries(i => (i < 40 ? 10 : 10 + (i - 40) * 0.5), 80)
    const t = computeTrendSignal(bars)
    expect(t.score).toBeGreaterThan(50)
    expect(t.signal).toBe('buy')
  })

  it('scores sell when close below MA20', () => {
    const bars = makeSeries(i => (i < 40 ? 20 : 20 - (i - 40) * 0.2), 80)
    const t = computeTrendSignal(bars)
    expect(t.score).toBeLessThan(50)
    expect(t.signal).toBe('sell')
  })

  it('returns hold when data insufficient', () => {
    const bars = makeSeries(() => 10, 10)
    const t = computeTrendSignal(bars)
    expect(t.signal).toBe('hold')
    expect(t.score).toBe(50)
  })

  it('score stays within 0-100', () => {
    const bars = makeSeries(i => 10 + Math.sin(i * 0.5) * 3, 60)
    const t = computeTrendSignal(bars)
    expect(t.score).toBeGreaterThanOrEqual(0)
    expect(t.score).toBeLessThanOrEqual(100)
  })
})

describe('computeRegime（效率比率判趋势/震荡）', () => {
  it('steady rise is a trend market', () => {
    const bars = makeSeries(i => 10 + i * 0.1, 40)
    const r = computeRegime(bars)
    expect(r.regime).toBe('trend')
    expect(r.er).toBeGreaterThan(0.8)
  })

  it('oscillating flat series is a range market', () => {
    const bars = makeSeries(i => 10 + Math.sin(i * 1.0) * 1, 40)
    const r = computeRegime(bars)
    expect(r.regime).toBe('range')
    expect(r.er).toBeLessThan(0.2)
  })
})

describe('computeDualSignal（双模式：震荡抄底/趋势顺势）', () => {
  it('uses trend mode in a trending market and buys above MA20', () => {
    const bars = makeSeries(i => 10 + i * 0.2, 40)
    const d = computeDualSignal(bars)
    expect(d.mode).toBe('trend')
    expect(d.signal).toBe('buy')
  })

  it('uses range mode in a choppy market', () => {
    const bars = makeSeries(i => 10 + Math.sin(i * 0.5) * 3, 40)
    const d = computeDualSignal(bars)
    expect(d.mode).toBe('range')
  })
})
