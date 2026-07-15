import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'

function sma(bars: KLine[], period: number): number[] {
  const result: number[] = []
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += bars[j].close
    }
    result.push(sum / period)
  }
  return result
}

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
  const offset = slowPeriod - fastPeriod
  const dif: number[] = []
  for (let i = 0; i < emaFast.length; i++) {
    dif.push(emaFast[i] - (emaSlow[i + offset] ?? emaSlow[emaSlow.length - 1]))
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
  description: '基于均线多头/空头排列和MACD判断趋势方向',
  params: FACTOR_PARAMS.trend,

  calculate(bars: KLine[]): number {
    if (bars.length < 60) return 50
    const p = this.params
    const ma5 = sma(bars, p.maFast as number)
    const ma20 = sma(bars, p.maMid as number)
    const ma60 = sma(bars, p.maSlow as number)

    const latest5 = ma5[ma5.length - 1]
    const latest20 = ma20[ma20.length - 1]
    const latest60 = ma60[ma60.length - 1]

    let alignmentScore = 0
    if (latest5 > latest20 && latest20 > latest60) {
      alignmentScore = 60
    } else if (latest5 < latest20 && latest20 < latest60) {
      alignmentScore = 0
    } else if (latest5 > latest60) {
      alignmentScore = 40
    } else {
      alignmentScore = 20
    }

    const { histogram } = macd(
      bars,
      p.macdFast as number,
      p.macdSlow as number,
      p.macdSignal as number
    )
    const latestHist = histogram[histogram.length - 1]
    const prevHist = histogram[histogram.length - 2] ?? 0

    let macdScore = 20
    if (latestHist > 0 && latestHist > prevHist) {
      macdScore = 40
    } else if (latestHist > 0 && latestHist < prevHist) {
      macdScore = 30
    } else if (latestHist < 0 && latestHist > prevHist) {
      macdScore = 15
    } else if (latestHist < 0 && latestHist < prevHist) {
      macdScore = 0
    }

    return Math.round(alignmentScore + macdScore)
  },
}
