import type { Factor, KLine } from '../../types'
import { scoreETF } from './scorer'

export interface FactorICResult {
  factorId: string
  name: string
  /** Pearson 相关：因子分数 vs 未来 N 日收益。>0 表示高分确实预示上涨 */
  ic: number
  /** 命中率：(分数>50) 与 (未来上涨) 一致的比例 */
  hitRate: number
  sampleCount: number
}

export interface DiagnosticsResult {
  factors: FactorICResult[]
  compositeIC: number
  forwardDays: number
  /** 综合分五等分分层的平均未来收益，验证单调性 */
  bins: { label: string; avgReturn: number; count: number }[]
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0
  const mx = x.slice(0, n).reduce((s, v) => s + v, 0) / n
  const my = y.slice(0, n).reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my)
    dx += (x[i] - mx) ** 2
    dy += (y[i] - my) ** 2
  }
  if (dx === 0 || dy === 0) return 0
  return num / Math.sqrt(dx * dy)
}

/**
 * 因子有效性诊断：对历史每一天用当前权重打分，对比未来 forwardDays 日收益，
 * 计算每个因子的 IC（分数与未来收益的相关性）、命中率，以及综合分的分层单调性。
 * 这是对"指标是否真有信息量"的诚实检验——若 IC≈0，说明该因子没有预测力。
 */
export function runDiagnostics(
  bars: KLine[],
  factors: Factor[],
  weights: Record<string, number>,
  forwardDays = 5
): DiagnosticsResult {
  const start = 60
  const maxIdx = bars.length - 1 - forwardDays
  if (maxIdx <= start) return { factors: [], compositeIC: 0, forwardDays, bins: [] }

  const perFactor: Record<string, number[]> = {}
  for (const f of factors) perFactor[f.id] = []
  const composites: number[] = []
  const forwardReturns: number[] = []

  for (let i = start; i <= maxIdx; i++) {
    const result = scoreETF(bars.slice(0, i + 1), weights)
    const fwd = bars[i + forwardDays].close / bars[i].close - 1
    composites.push(result.compositeScore)
    forwardReturns.push(fwd)
    for (const fs of result.factorScores) {
      perFactor[fs.factorId].push(fs.score)
    }
  }

  const factorsRes: FactorICResult[] = factors.map(f => {
    const xs = perFactor[f.id] ?? []
    let hits = 0
    for (let k = 0; k < xs.length; k++) {
      if ((xs[k] > 50) === (forwardReturns[k] > 0)) hits++
    }
    return {
      factorId: f.id,
      name: f.name,
      ic: pearson(xs, forwardReturns),
      hitRate: xs.length > 0 ? hits / xs.length : 0,
      sampleCount: xs.length,
    }
  })

  // 综合分五等分分层：分数越高，平均未来收益是否越高（单调性）
  const pairs = composites.map((c, k) => ({ c, r: forwardReturns[k] }))
  pairs.sort((a, b) => a.c - b.c)
  const bins: DiagnosticsResult['bins'] = []
  if (pairs.length >= 10) {
    const n = 5
    const size = Math.floor(pairs.length / n)
    for (let b = 0; b < n; b++) {
      const slice = pairs.slice(b * size, b === n - 1 ? pairs.length : (b + 1) * size)
      const avg = slice.reduce((s, p) => s + p.r, 0) / (slice.length || 1)
      bins.push({ label: `Q${b + 1}`, avgReturn: avg, count: slice.length })
    }
  }

  return {
    factors: factorsRes,
    compositeIC: pearson(composites, forwardReturns),
    forwardDays,
    bins,
  }
}
