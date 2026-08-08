import { describe, it, expect } from 'vitest'
import { computeTrendSignal } from '../../src/engine/etf/trendSignal'
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

describe('computeTrendSignal', () => {
  it('scores buy when close above MA20 AND band expanding (breakout from squeeze)', () => {
    // 长期横盘（带宽收窄）后最近几天放量突破 → 带宽扩张
    const bars = makeSeries(i => {
      if (i < 70) return 10
      return [10.5, 11.2, 12.1][i - 70]
    }, 73)
    const t = computeTrendSignal(bars)
    expect(t.score).toBeGreaterThan(50)
    expect(t.signal).toBe('buy')
  })

  it('holds when close above MA20 but band not expanding (steady rally)', () => {
    // 匀速上涨：带宽恒定不扩张 → 观望，不追
    const bars = makeSeries(i => 10 + i * 0.05, 80)
    const t = computeTrendSignal(bars)
    expect(t.score).toBeGreaterThan(50)
    expect(t.signal).toBe('hold')
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
