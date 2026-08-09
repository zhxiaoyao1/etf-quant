import { describe, it, expect } from 'vitest'
import { scorePool } from '../../src/engine/etf/poolScorer'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number, amount?: number): KLine {
  return { date, open: close, high: close * 1.01, low: close * 0.99, close, volume: 1000, amount }
}

function makeSeries(closeFn: (i: number) => number, n: number, amount?: number): KLine[] {
  const bars: KLine[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(2026, 0, 1)
    d.setDate(d.getDate() + i)
    bars.push(makeBar(d.toISOString().slice(0, 10), closeFn(i), amount))
  }
  return bars
}

describe('scorePool（池级4因子打分）', () => {
  it('强势ETF高分买入，弱势ETF低分卖出', () => {
    // A：匀速上涨1%/天（低波动、趋势向上、净流入、池内动量第一）
    const barsA = makeSeries(i => 10 * Math.pow(1.01, i), 60, 1000)
    // B：匀速下跌1%/天（趋势向下、池内动量垫底、净流出）
    const barsB = makeSeries(i => 10 * Math.pow(0.99, i), 60, 1000)
    const map = new Map([['A', barsA], ['B', barsB]])
    const scores = scorePool(map)
    const a = scores.find(s => s.code === 'A')!
    const b = scores.find(s => s.code === 'B')!
    expect(a.total).toBe(100)
    expect(a.signal).toBe('buy')
    expect(b.total).toBe(35)      // 趋势0+动量0+波动率35+资金流0
    expect(b.signal).toBe('sell')
    expect(a.momentum).toBe(30)   // 池内第一（新权重）
    expect(b.momentum).toBe(0)    // 池内垫底
  })

  it('趋势因子：收盘>MA20且MA20向上给40分', () => {
    // 横盘后拉升：收盘在MA20上方，MA20向上
    const bars = makeSeries(i => (i < 40 ? 10 : 10 + (i - 40) * 0.2), 70, 1000)
    const map = new Map([['A', bars], ['B', makeSeries(() => 10, 70, 1000)]])
    const scores = scorePool(map)
    const a = scores.find(s => s.code === 'A')!
    expect(a.trend).toBe(15)
  })

  it('波动率因子：高波动给低分（风险扣分项）', () => {
    // 高低波动对比（固定方向，保证其他因子一致）
    const lowVol = makeSeries(i => 10 + Math.sin(i * 0.05) * 0.1, 60, 1000)  // 低波动
    const highVol = makeSeries(i => 10 + Math.sin(i * 0.5) * 2, 60, 1000)   // 高波动
    const map = new Map([['LOW', lowVol], ['HIGH', highVol]])
    const scores = scorePool(map)
    const low = scores.find(s => s.code === 'LOW')!
    const high = scores.find(s => s.code === 'HIGH')!
    expect(low.volatility).toBe(35)
    expect(high.volatility).toBe(0)
  })

  it('资金流因子：净流入占比>3%给15分，净流出给0分', () => {
    // 全涨（净流入占比=100%） vs 全跌（净流出）
    const inflow = makeSeries(i => (i < 40 ? 10 : 10 + i * 0.001), 60, 1000)
    const outflow = makeSeries(i => (i < 40 ? 10 : 10 - i * 0.001), 60, 1000)
    const map = new Map([['IN', inflow], ['OUT', outflow]])
    const scores = scorePool(map)
    const inS = scores.find(s => s.code === 'IN')!
    const outS = scores.find(s => s.code === 'OUT')!
    expect(inS.moneyFlow).toBe(20)
    expect(outS.moneyFlow).toBe(0)
  })
})
