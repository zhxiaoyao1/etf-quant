import type { KLine } from '../../types'
import { calcTrend, calcVolatility, calcMoneyFlow, roc20 } from './poolScorer'

export interface PortfolioBacktestResult {
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  sharpeRatio: number
  equityCurve: { date: string; value: number }[]
  tradeCount: number
}

/** 分数决定的单只ETF仓位上限：75-100 → 80%；65-74 → 50% */
function cap(score: number): number {
  if (score >= 75) return 0.8
  if (score >= 65) return 0.5
  return 0
}

const BUY = 65
const SELL = 45

/**
 * 组合级回测：对整个池子按分数规则做组合管理。
 * - 分数 ≥65：买入/持有（按分数上限仓位，75-100→80%，65-74→50%）
 * - 45~64：持有现有、不开新仓
 * - <45：清仓
 * 以每日收盘价执行再平衡（简化）。
 */
export function runPortfolioBacktest(
  barsByCode: Map<string, KLine[]>,
  initialCapital = 100000
): PortfolioBacktestResult {
  const codes = [...barsByCode.keys()]
  if (codes.length < 2) {
    return { totalReturn: 0, annualizedReturn: 0, maxDrawdown: 0, sharpeRatio: 0, equityCurve: [], tradeCount: 0 }
  }
  const maxLen = Math.min(...codes.map(c => barsByCode.get(c)!.length))
  const start = 60

  let cash = initialCapital
  const shares: Record<string, number> = {}
  const equityCurve: { date: string; value: number }[] = []
  let tradeCount = 0

  for (let t = start; t < maxLen; t++) {
    // 池内打分（含动量排名）
    const perCode: Record<string, { trend: number; vol: number; flow: number; roc: number }> = {}
    for (const code of codes) {
      const slice = barsByCode.get(code)!.slice(0, t + 1)
      perCode[code] = { trend: calcTrend(slice), vol: calcVolatility(slice), flow: calcMoneyFlow(slice), roc: roc20(slice) }
    }
    const ranked = [...codes].sort((a, b) => perCode[b].roc - perCode[a].roc)
    const n = ranked.length
    const totals: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const code = ranked[i]
      const rank = n > 1 ? i / (n - 1) : 0.5
      const momentum = rank < 0.2 ? 25 : rank >= 0.8 ? 0 : 12
      totals[code] = perCode[code].trend + momentum + perCode[code].vol + perCode[code].flow
    }

    // 当前组合市值
    let equity = cash
    for (const code of codes) {
      equity += (shares[code] ?? 0) * barsByCode.get(code)![t].close
    }
    equityCurve.push({ date: barsByCode.get(codes[0])![t].date, value: equity })

    // 目标权重：<45清仓，45-64持有现有不开新仓，≥65按分数仓位
    const targets: Record<string, number> = {}
    for (const code of codes) {
      const t = totals[code]
      if (t < SELL) {
        targets[code] = 0
      } else if (t < BUY) {
        const price = barsByCode.get(code)![t].close
        targets[code] = (shares[code] ?? 0) > 0 && equity > 0 ? (shares[code]! * price) / equity : 0
      } else {
        targets[code] = cap(t)
      }
    }
    // 总仓位不超过100%：超了按比例缩放，防止隐性加杠杆导致复利爆炸
    const sumTarget = Object.values(targets).reduce((s, w) => s + w, 0)
    if (sumTarget > 1) {
      for (const code of codes) targets[code] = (targets[code] ?? 0) / sumTarget
    }

    // 再平衡（t日收盘价）
    for (const code of codes) {
      const price = barsByCode.get(code)![t].close
      if (price <= 0) continue
      const targetShares = ((targets[code] ?? 0) * equity) / price
      const cur = shares[code] ?? 0
      if (Math.abs(targetShares - cur) * price > equity * 0.001) {
        cash -= (targetShares - cur) * price
        shares[code] = targetShares
        tradeCount++
      }
    }
    if (cash < 0) cash = 0
  }

  // 指标
  const finalValue = cash + codes.reduce((s, c) => s + (shares[c] ?? 0) * barsByCode.get(c)![maxLen - 1].close, 0)
  const totalReturn = (finalValue - initialCapital) / initialCapital
  const years = (maxLen - start) / 252
  const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0

  let maxDrawdown = 0
  let peak = initialCapital
  for (const p of equityCurve) {
    if (p.value > peak) peak = p.value
    const dd = (p.value - peak) / peak
    if (dd < maxDrawdown) maxDrawdown = dd
  }

  const dailyReturns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push((equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value)
  }
  const avgR = dailyReturns.reduce((s, r) => s + r, 0) / (dailyReturns.length || 1)
  const stdR = Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgR) ** 2, 0) / (dailyReturns.length || 1))
  const sharpeRatio = stdR > 0 ? (avgR / stdR) * Math.sqrt(252) : 0

  return { totalReturn, annualizedReturn, maxDrawdown, sharpeRatio, equityCurve, tradeCount }
}
