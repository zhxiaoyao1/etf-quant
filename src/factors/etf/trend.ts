import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'
import { smaSeries, atr, clamp, reversalCandlePenalty } from '../../engine/common'

function ema(bars: KLine[], period: number): number[] {
  const result: number[] = []
  const k = 2 / (period + 1)
  let prev = bars.slice(0, period).reduce((s, b) => s + b.close, 0) / period
  result.push(prev)
  for (let i = period; i < bars.length; i++) {
    prev = bars[i].close * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

function macd(
  bars: KLine[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { dif: number[]; dea: number[]; histogram: number[] } {
  const emaFast = ema(bars, fastPeriod)
  const emaSlow = ema(bars, slowPeriod)
  // Pad emaSlow to match emaFast length by repeating the last value
  for (let j = emaSlow.length; j < emaFast.length; j++) {
    emaSlow.push(emaSlow[emaSlow.length - 1])
  }
  const dif: number[] = []
  for (let i = 0; i < emaFast.length; i++) {
    dif.push(emaFast[i] - emaSlow[i])
  }
  const deaValues: number[] = []
  const k = 2 / (signalPeriod + 1)
  let deaPrev = dif.slice(0, signalPeriod).reduce((s, v) => s + v, 0) / signalPeriod
  deaValues.push(deaPrev)
  for (let i = signalPeriod; i < dif.length; i++) {
    deaPrev = dif[i] * k + deaPrev * (1 - k)
    deaValues.push(deaPrev)
  }
  const histogram = dif.slice(signalPeriod - 1).map((d, i) => d - deaValues[i])
  return { dif, dea: deaValues, histogram }
}

export const trendFactor: Factor = {
  id: 'trend',
  name: '趋势',
  description: '基于均线排列、MA20斜率和MACD连续评分判断趋势强弱（越强越高分）',
  params: FACTOR_PARAMS.trend,

  calculate(bars: KLine[]): number {
    if (bars.length < 60) return 50
    const p = this.params
    const closePrices = bars.map(b => b.close)
    const ma5 = smaSeries(closePrices, p.maFast as number)
    const ma20 = smaSeries(closePrices, p.maMid as number)
    const ma60 = smaSeries(closePrices, p.maSlow as number)
    const a = atr(bars, 14)
    if (a <= 0) return 50

    const last5 = ma5[ma5.length - 1]
    const last20 = ma20[ma20.length - 1]
    const last60 = ma60[ma60.length - 1]
    const last = bars[bars.length - 1]
    const close = last.close

    // 1) 排列度（0~40）：MA5-MA20 与 MA20-MA60 价差（ATR 单位），tanh 平滑连续
    const s1 = (last5 - last20) / a
    const s2 = (last20 - last60) / a
    const alignment = clamp(20 + 20 * Math.tanh((s1 + s2) / 2), 0, 40)

    // 2) MA20 斜率（0~30）：MA20 对比 5 日前（ATR 单位）
    const slopeRef = ma20.length > 6 ? ma20[ma20.length - 6] : ma20[0]
    const slope = (last20 - slopeRef) / a
    const slopeScore = clamp(15 + 15 * Math.tanh(slope / 1.0), 0, 30)

    // 3) MACD 状态（0~30）：柱状图大小（ATR 归一）
    const { histogram } = macd(bars, p.macdFast as number, p.macdSlow as number, p.macdSignal as number)
    const hist = histogram[histogram.length - 1]
    const macdScore = clamp(15 + 15 * Math.tanh(hist / (0.5 * a)), 0, 30)

    // 4) 冲高回落闸门：近3日暴涨（ATR 单位）→ 扣分，防止追在尖顶
    const close3 = bars[bars.length - 4].close
    const surge = (close - close3) / a
    const surgePenalty = surge > 3 ? clamp((surge - 3) * 10, 0, 20) : 0

    // 5) 形态惩罚：长上影 + 收在低位
    const candlePenalty = reversalCandlePenalty(last)

    return Math.round(clamp(alignment + slopeScore + macdScore - surgePenalty - candlePenalty, 0, 100))
  },
}
