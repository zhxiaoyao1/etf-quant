import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'
import { atr, clamp, reversalCandlePenalty } from '../../engine/common'

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

export const momentumFactor: Factor = {
  id: 'momentum',
  name: '动量',
  description: '基于多周期收益、距52周高点和RSI确认判断动量（越强越高分）',
  params: FACTOR_PARAMS.momentum,

  calculate(bars: KLine[]): number {
    if (bars.length < 61) return 50
    const close = bars[bars.length - 1].close
    const last = bars[bars.length - 1]
    const a = atr(bars, 14)
    if (a <= 0) return 50

    // 1) 多周期收益（0~50）：近20日、近60日涨跌幅加权
    const c20 = bars[bars.length - 21].close
    const c60 = bars[bars.length - 61].close
    const roc20 = close / c20 - 1
    const roc60 = close / c60 - 1
    const blend = 0.6 * Math.tanh(roc20 / 0.04) + 0.4 * Math.tanh(roc60 / 0.08)
    const rocScore = clamp(25 + 25 * blend, 0, 50)

    // 2) 距52周高点（0~30）：越接近历史新高越强
    let maxHigh = -Infinity
    for (let i = Math.max(0, bars.length - 250); i < bars.length; i++) {
      if (bars[i].high > maxHigh) maxHigh = bars[i].high
    }
    const highPos = close / maxHigh
    const highScore = clamp(30 * (2 * highPos - 1), 0, 30)

    // 3) RSI 确认（0~20）：趋势确认，不再当超买超卖用
    const rsiValue = rsi(bars, this.params.rsiPeriod as number)
    const rsiScore = clamp(10 + 10 * Math.tanh((rsiValue - 50) / 20), 0, 20)

    // 4) 冲高回落闸门：近3日暴涨（ATR 单位）→ 扣分
    const close3 = bars[bars.length - 4].close
    const surge = (close - close3) / a
    const surgePenalty = surge > 3 ? clamp((surge - 3) * 10, 0, 20) : 0

    // 5) 形态惩罚：长上影 + 收在低位
    const candlePenalty = reversalCandlePenalty(last)

    return Math.round(clamp(rocScore + highScore + rsiScore - surgePenalty - candlePenalty, 0, 100))
  },
}
