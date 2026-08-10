import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'

export const moneyFlowFactor: Factor = {
  id: 'moneyFlow',
  name: '资金流',
  description: '基于成交量和OBV趋势判断资金态度',
  params: FACTOR_PARAMS.moneyFlow,

  calculate(bars: KLine[]): number {
    if (bars.length < 10) return 50
    const period = this.params.volChangePeriod as number
    const recent = bars.slice(-period)

    let upVolume = 0
    let downVolume = 0
    for (let i = 1; i < recent.length; i++) {
      const priceChange = recent[i].close - recent[i - 1].close
      if (priceChange > 0) {
        upVolume += recent[i].volume
      } else {
        downVolume += recent[i].volume
      }
    }
    const totalVolume = upVolume + downVolume

    let obv = 0
    const obvValues: number[] = []
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].close > bars[i - 1].close) {
        obv += bars[i].volume
      } else if (bars[i].close < bars[i - 1].close) {
        obv -= bars[i].volume
      }
      obvValues.push(obv)
    }
    const recentObv = obvValues.slice(-5)
    const obvTrend = recentObv[recentObv.length - 1] - recentObv[0]

    let volumeScore = 30
    if (totalVolume > 0) {
      const upRatio = upVolume / totalVolume
      if (upRatio > 0.65) {
        volumeScore = 60
      } else if (upRatio > 0.5) {
        volumeScore = 45
      } else if (upRatio < 0.35) {
        volumeScore = 0
      } else {
        volumeScore = 15
      }
    }

    let obvScore = 20
    if (obvTrend > 0 && obvValues.length > 0) {
      obvScore = 40
    } else if (obvTrend > 0) {
      obvScore = 30
    } else if (obvTrend < 0 && obvValues.length > 0) {
      obvScore = 0
    } else {
      obvScore = 10
    }

    return Math.round(volumeScore + obvScore)
  },
}
