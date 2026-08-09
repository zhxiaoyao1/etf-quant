import type { KLine } from '../../types'
import { sma } from '../common'

/**
 * 因子权重（按 60 日 IC 强度分配，实测：动量0.133、波动率-0.271、趋势0.049、资金流0.069）：
 * 波动率最强（风险回避）、动量次之（正向信号）、趋势/资金流弱（降权）。
 */
export const POOL_WEIGHTS = {
  trend: { strong: 15, flat: 7 },
  momentum: { top: 30, mid: 15 },
  volatility: { low: 35, mid: 21 },
  moneyFlow: { strong: 20, weak: 9 },
}

export interface PoolFactorScores {
  code: string
  trend: number       // 0-15
  momentum: number    // 0-30（池内排名）
  volatility: number  // 0-35
  moneyFlow: number   // 0-20
  total: number       // 0-100
  signal: 'buy' | 'hold' | 'sell'
}

/** 20日涨跌幅（用于池内动量排名） */
export function roc20(bars: KLine[]): number {
  if (bars.length < 21) return 0
  const c = bars[bars.length - 1].close
  const c20 = bars[bars.length - 21].close
  return c20 > 0 ? c / c20 - 1 : 0
}

/**
 * 趋势因子（0-15）：收盘价>MA20 且 MA20 向上 → 15；>MA20 但 MA20 走平 → 7；<MA20 → 0
 */
export function calcTrend(bars: KLine[]): number {
  if (bars.length < 21) return 0
  const closes = bars.map(b => b.close)
  const maToday = sma(closes, 20)
  const maYesterday = sma(closes.slice(0, -1), 20)
  if (closes[closes.length - 1] > maToday) {
    return maToday > maYesterday ? POOL_WEIGHTS.trend.strong : POOL_WEIGHTS.trend.flat
  }
  return 0
}

/**
 * 波动率因子（0-35，风险扣分项，IC最强-0.271）：20日日收益率的标准差 σ。
 * σ<1.8% → 35；1.8%~3.5% → 21；>3.5% → 0
 */
export function calcVolatility(bars: KLine[]): number {
  if (bars.length < 21) return 0
  const last21 = bars.slice(-21)
  const returns: number[] = []
  for (let i = 1; i < last21.length; i++) {
    const prev = last21[i - 1].close
    if (prev > 0) returns.push(last21[i].close / prev - 1)
  }
  if (returns.length < 5) return 0
  const mean = returns.reduce((s, v) => s + v, 0) / returns.length
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length
  const sigma = Math.sqrt(variance)
  if (sigma < 0.018) return POOL_WEIGHTS.volatility.low
  if (sigma <= 0.035) return POOL_WEIGHTS.volatility.mid
  return 0
}

/**
 * 资金流因子（0-20）：20日累计净流入 / 总成交额。
 * 注：真实"主力净流入"需东财资金流接口，这里用日线代理：
 * 涨日成交额计入流入、跌日计入流出，Σ净额/总额。
 * >3% → 20；0~3% → 9；<0 → 0
 */
export function calcMoneyFlow(bars: KLine[]): number {
  if (bars.length < 21) return 0
  const last20 = bars.slice(-20)
  let net = 0
  let total = 0
  for (let i = 1; i < last20.length; i++) {
    const amt = last20[i].amount ?? last20[i].volume
    total += amt
    if (last20[i].close > last20[i - 1].close) net += amt
    else if (last20[i].close < last20[i - 1].close) net -= amt
  }
  const ratio = total > 0 ? net / total : 0
  if (ratio > 0.03) return POOL_WEIGHTS.moneyFlow.strong
  if (ratio >= 0) return POOL_WEIGHTS.moneyFlow.weak
  return 0
}

/**
 * 池级打分：对池内所有 ETF 用同一套因子打分。
 * 动量用"20日涨幅池内排名"（避免牛熊整体偏移）：
 * 前20% → 25；中间60% → 12；末尾20% → 0
 *
 * 总分阈值：≥65 买入；45~64 持有；<45 卖出
 */
export function scorePool(barsByCode: Map<string, KLine[]>): PoolFactorScores[] {
  const codes = [...barsByCode.keys()]
  const barsOf = (code: string): KLine[] => barsByCode.get(code) ?? []

  // 池内动量排名（降序，index 越小越强）
  const ranked = codes
    .map(code => ({ code, roc: roc20(barsOf(code)) }))
    .sort((a, b) => b.roc - a.roc)
  const n = ranked.length

  return ranked.map(({ code }, i) => {
    const rank = n > 1 ? i / (n - 1) : 0.5  // 0=最强，1=最弱
    const momentum = rank < 0.2 ? POOL_WEIGHTS.momentum.top : rank >= 0.8 ? 0 : POOL_WEIGHTS.momentum.mid
    const trend = calcTrend(barsOf(code))
    const volatility = calcVolatility(barsOf(code))
    const moneyFlow = calcMoneyFlow(barsOf(code))
    const total = trend + momentum + volatility + moneyFlow
    const signal: PoolFactorScores['signal'] = total >= 65 ? 'buy' : total < 45 ? 'sell' : 'hold'
    return { code, trend, momentum, volatility, moneyFlow, total, signal }
  })
}
