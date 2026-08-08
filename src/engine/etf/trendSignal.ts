import type { KLine } from '../../types'
import { sma, clamp, bollingerWidth, bandExpanding } from '../common'

/** MA 周期 */
export const MA_PERIOD = 20

export interface TrendSignal {
  /** 趋势分 0-100：50 = 收盘价正好在 MA20 上，越高越强，越低越弱 */
  score: number
  signal: 'buy' | 'hold' | 'sell'
}

/**
 * 均线 + 布林带宽信号：
 * - 买入：收盘价在 MA20 上方 且 带宽扩张（趋势启动）
 * - 卖出：收盘价在 MA20 下方
 * - 观望：在均线上方但带宽未扩张（等待突破确认）
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

  // 带宽扩张：当前带宽 > 近20日均值（波动展开 = 趋势启动）
  const widths = bollingerWidth(bars, maPeriod)
  const expanding = bandExpanding(widths, bars.length - 1)

  const signal: TrendSignal['signal'] =
    score > 50 && expanding ? 'buy'
    : score > 50 ? 'hold'      // 在均线上方但带宽未扩张 → 观望
    : score < 50 ? 'sell'
    : 'hold'

  return { score, signal }
}
