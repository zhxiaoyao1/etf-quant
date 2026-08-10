import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'

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

function atr(bars: KLine[], period: number): number {
  if (bars.length < period + 1) return 0
  const slice = bars.slice(-period)
  let sum = 0
  for (let i = 1; i < slice.length; i++) {
    const high = slice[i].high
    const low = slice[i].low
    const prevClose = slice[i - 1].close
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    sum += tr
  }
  return sum / period
}

export const volatilityFactor: Factor = {
  id: 'volatility',
  name: '波动率',
  description: '基于布林带位置和ATR判断价格位置安全度',
  params: FACTOR_PARAMS.volatility,

  calculate(bars: KLine[]): number {
    if (bars.length < 25) return 50
    const { upper, lower } = bollingerBands(bars, this.params.bbPeriod as number, this.params.bbStdDev as number)
    const currentPrice = bars[bars.length - 1].close
    const atrValue = atr(bars, this.params.atrPeriod as number)
    const atrRatio = atrValue / currentPrice

    const position = (currentPrice - lower) / (upper - lower || 0.001)
    let bbScore = 0
    if (position <= 0.2) {
      bbScore = 70
    } else if (position <= 0.4) {
      bbScore = 55
    } else if (position <= 0.6) {
      bbScore = 35
    } else if (position <= 0.8) {
      bbScore = 15
    } else {
      bbScore = 0
    }

    let atrPenalty = 0
    if (atrRatio > 0.05) {
      atrPenalty = 30
    } else if (atrRatio > 0.03) {
      atrPenalty = 15
    }

    return Math.round(Math.max(0, bbScore - atrPenalty))
  },
}
