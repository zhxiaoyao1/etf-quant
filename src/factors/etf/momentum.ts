import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'

function rsi(bars: KLine[], period: number): number {
  if (bars.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = bars.length - period; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close
    if (change > 0) gains += change
    else losses += Math.abs(change)
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

function kdj(
  bars: KLine[],
  period: number,
  _signalPeriod: number
): { k: number; d: number; j: number } {
  if (bars.length < period) return { k: 50, d: 50, j: 50 }
  const idx = bars.length - 1
  const highestHigh = Math.max(...bars.slice(idx - period + 1, idx + 1).map(b => b.high))
  const lowestLow = Math.min(...bars.slice(idx - period + 1, idx + 1).map(b => b.low))
  const rsv = ((bars[idx].close - lowestLow) / (highestHigh - lowestLow || 1)) * 100
  const k = rsv
  const d = k
  const j = 3 * k - 2 * d
  return { k: Math.max(0, Math.min(100, k)), d: Math.max(0, Math.min(100, d)), j: Math.max(0, Math.min(100, j)) }
}

export const momentumFactor: Factor = {
  id: 'momentum',
  name: '动量',
  description: '基于RSI和KDJ判断买卖力道',
  params: FACTOR_PARAMS.momentum,

  calculate(bars: KLine[]): number {
    if (bars.length < 20) return 50
    const rsiValue = rsi(bars, this.params.rsiPeriod as number)
    const { k: kValue } = kdj(bars, this.params.kdjPeriod as number, this.params.kdjSignal as number)

    let rsiScore = 0
    if (rsiValue >= 30 && rsiValue <= 50) {
      rsiScore = 60
    } else if (rsiValue > 50 && rsiValue <= 65) {
      rsiScore = 40
    } else if (rsiValue > 20 && rsiValue < 30) {
      rsiScore = 30
    } else if (rsiValue >= 65 && rsiValue <= 80) {
      rsiScore = 15
    } else if (rsiValue > 80) {
      rsiScore = 0
    } else {
      rsiScore = 10
    }

    let kdjScore = 0
    if (kValue >= 20 && kValue <= 50) {
      kdjScore = 40
    } else if (kValue > 50 && kValue <= 70) {
      kdjScore = 25
    } else if (kValue < 20) {
      kdjScore = 20
    } else {
      kdjScore = 0
    }

    return Math.round(rsiScore + kdjScore)
  },
}
