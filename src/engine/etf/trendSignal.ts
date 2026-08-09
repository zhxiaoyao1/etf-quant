import type { KLine } from '../../types'
import { sma, clamp } from '../common'

/** MA 周期 */
export const MA_PERIOD = 20

export interface TrendSignal {
  /** 趋势分 0-100：50 = 收盘价正好在 MA20 上，越高越强，越低越弱 */
  score: number
  signal: 'buy' | 'hold' | 'sell'
}

/**
 * 纯均线趋势信号：收盘价在 MA20 上方看多（score>50），下方看空（score<50）。
 * 布林带只做展示，不参与买卖决策。
 */
export function computeTrendSignal(
  bars: KLine[],
  maPeriod: number = MA_PERIOD
): TrendSignal {
  if (bars.length < maPeriod) {
    return { score: 50, signal: 'hold' }
  }
  const closes = bars.map(b => b.close)
  const ma = sma(closes, maPeriod)
  const close = bars[bars.length - 1].close
  if (ma <= 0) return { score: 50, signal: 'hold' }

  const score = clamp(Math.round(50 + ((close - ma) / ma) * 500), 0, 100)
  const signal: TrendSignal['signal'] = score > 50 ? 'buy' : score < 50 ? 'sell' : 'hold'
  return { score, signal }
}
