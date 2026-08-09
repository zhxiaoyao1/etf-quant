import type { KLine } from '../../types'
import { calcTrend, calcVolatility, calcMoneyFlow, roc20 } from './poolScorer'

export interface PoolFactorIC {
  factor: 'trend' | 'momentum' | 'volatility' | 'moneyFlow' | 'total'
  ic: number
  sampleCount: number
}

export interface PoolDiagnosticsResult {
  factors: PoolFactorIC[]
  forwardDays: number
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
 * 池级 IC 诊断：对每个共同交易日，用同一套打分规则给池内全部 ETF 打分，
 * 统计每个因子分数与未来 N 日收益的相关性（IC）。
 * 这是"这套因子到底有没有预测力"的诚实检验。
 */
export function runPoolDiagnostics(
  barsByCode: Map<string, KLine[]>,
  forwardDays = 5
): PoolDiagnosticsResult {
  const codes = [...barsByCode.keys()]
  if (codes.length < 2) return { factors: [], forwardDays }

  const trendScores: number[] = []
  const momentumScores: number[] = []
  const volScores: number[] = []
  const flowScores: number[] = []
  const totalScores: number[] = []
  const fwdReturns: number[] = []

  const maxLen = Math.min(...codes.map(c => barsByCode.get(c)!.length))
  const start = 60
  const end = maxLen - 1 - forwardDays

  for (let t = start; t <= end; t++) {
    // 每只ETF在 t 日的因子原始分
    const perCode: Record<string, { trend: number; vol: number; flow: number; roc: number }> = {}
    for (const code of codes) {
      const slice = barsByCode.get(code)!.slice(0, t + 1)
      perCode[code] = {
        trend: calcTrend(slice),
        vol: calcVolatility(slice),
        flow: calcMoneyFlow(slice),
        roc: roc20(slice),
      }
    }
    // 池内动量排名
    const ranked = [...codes].sort((a, b) => perCode[b].roc - perCode[a].roc)
    const n = ranked.length
    for (let i = 0; i < n; i++) {
      const code = ranked[i]
      const rank = n > 1 ? i / (n - 1) : 0.5
      const momentum = rank < 0.2 ? 25 : rank >= 0.8 ? 0 : 12
      const total = perCode[code].trend + momentum + perCode[code].vol + perCode[code].flow
      const bars = barsByCode.get(code)!
      const fwd = bars[t + forwardDays].close / bars[t].close - 1
      trendScores.push(perCode[code].trend)
      momentumScores.push(momentum)
      volScores.push(perCode[code].vol)
      flowScores.push(perCode[code].flow)
      totalScores.push(total)
      fwdReturns.push(fwd)
    }
  }

  const mk = (factor: PoolFactorIC['factor'], xs: number[]): PoolFactorIC => ({
    factor,
    ic: pearson(xs, fwdReturns),
    sampleCount: xs.length,
  })

  return {
    factors: [
      mk('trend', trendScores),
      mk('momentum', momentumScores),
      mk('volatility', volScores),
      mk('moneyFlow', flowScores),
      mk('total', totalScores),
    ],
    forwardDays,
  }
}
