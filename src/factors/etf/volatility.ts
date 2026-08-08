import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'
import { atr, clamp } from '../../engine/common'

function bollingerBands(bars: KLine[], period: number, stdDev: number) {
  if (bars.length < period) return { upper: 0, middle: 0, lower: 0, width: 0 }
  const slice = bars.slice(-period)
  const closes = slice.map(b => b.close)
  const mean = closes.reduce((s, v) => s + v, 0) / period
  const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period
  const std = Math.sqrt(variance)
  return {
    upper: mean + stdDev * std,
    middle: mean,
    lower: mean - stdDev * std,
    width: (2 * stdDev * std) / mean,
  }
}

export const volatilityFactor: Factor = {
  id: 'volatility',
  name: '波动率',
  description: '基于布林中轨位置判断价格强弱区间（中轨上方=强势），并用ATR惩罚高波动',
  params: FACTOR_PARAMS.volatility,

  calculate(bars: KLine[]): number {
    if (bars.length < 25) return 50
    const { upper, middle, lower } = bollingerBands(bars, this.params.bbPeriod as number, this.params.bbStdDev as number)
    const currentPrice = bars[bars.length - 1].close
    const a = atr(bars, this.params.atrPeriod as number)
    if (currentPrice <= 0) return 50

    // 1) 布林中轨位置（0~70）：中轨上方=强势，贴近上轨最高，跌破中轨走低
    const bandWidth = upper - lower
    const position = bandWidth > 0 ? (currentPrice - middle) / bandWidth : 0
    const positionScore = clamp(35 + 70 * position, 0, 70)

    // 2) ATR 混乱惩罚（0~30）：波动率过高 = 行情混乱 → 扣分
    const atrPct = a / currentPrice
    const atrPenalty = clamp(((atrPct - 0.03) / 0.02) * 30, 0, 30)

    return Math.round(clamp(positionScore - atrPenalty, 0, 100))
  },
}
