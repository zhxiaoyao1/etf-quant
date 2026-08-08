import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'
import { clamp } from '../../engine/common'

/** 成交额，旧数据缺 amount 时回退到成交量 */
function amt(bar: KLine): number {
  return bar.amount ?? bar.volume
}

function avgAmount(bars: KLine[], n: number): number {
  if (bars.length === 0) return 0
  const slice = bars.slice(-n)
  return slice.reduce((s, b) => s + amt(b), 0) / slice.length
}

export const moneyFlowFactor: Factor = {
  id: 'moneyFlow',
  name: '资金流',
  description: '基于成交额OBV、量比、涨跌额占比和量价背离判断资金态度',
  params: FACTOR_PARAMS.moneyFlow,

  calculate(bars: KLine[]): number {
    if (bars.length < 30) return 50

    // 成交额加权 OBV
    const obvValues: number[] = []
    let obv = 0
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].close > bars[i - 1].close) obv += amt(bars[i])
      else if (bars[i].close < bars[i - 1].close) obv -= amt(bars[i])
      obvValues.push(obv)
    }

    // 1) OBV 斜率（0~40）：近10日净流入占总成交额比例
    const totalAmt10 = avgAmount(bars, 10) * 10
    const obvNow = obvValues[obvValues.length - 1]
    const obv10Ago = obvValues.length > 10 ? obvValues[obvValues.length - 10] : obvValues[0]
    const obvSlope = totalAmt10 > 0 ? (obvNow - obv10Ago) / totalAmt10 : 0
    const obvScore = clamp(20 + 20 * Math.tanh(obvSlope / 0.15), 0, 40)

    // 2) 量比（0~30）：5日均额 / 20日均额，>1 表示近期放量
    const avg5 = avgAmount(bars, 5)
    const avg20 = avgAmount(bars, 20)
    const volRatio = avg20 > 0 ? avg5 / avg20 : 1
    const volScore = clamp(15 + 15 * Math.tanh((volRatio - 1) / 0.5), 0, 30)

    // 3) 涨跌额占比（0~30）：近5日上涨成交额占比
    let upAmt = 0
    let downAmt = 0
    for (let i = bars.length - 5; i < bars.length; i++) {
      if (bars[i].close > bars[i - 1].close) upAmt += amt(bars[i])
      else if (bars[i].close < bars[i - 1].close) downAmt += amt(bars[i])
    }
    const upRatio = upAmt + downAmt > 0 ? upAmt / (upAmt + downAmt) : 0.5
    const upScore = clamp(upRatio * 60 - 15, 0, 30)

    // 4) 量价背离扣分（0~15）：创20日新高但OBV走弱 = 高位出货
    let divergencePenalty = 0
    if (bars.length > 21) {
      const priorMax = Math.max(...bars.slice(-21, -1).map(b => b.high))
      const last = bars[bars.length - 1]
      if (last.high >= priorMax && obvSlope < -0.05) {
        divergencePenalty = clamp((-obvSlope / 0.2) * 15, 0, 15)
      }
    }

    return Math.round(clamp(obvScore + volScore + upScore - divergencePenalty, 0, 100))
  },
}
