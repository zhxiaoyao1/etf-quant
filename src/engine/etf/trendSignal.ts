import type { KLine } from '../../types'
import { sma, clamp } from '../common'

/** MA 周期 */
export const MA_PERIOD = 20

export interface TrendSignal {
  /** 趋势分 0-100：50 = 收盘价正好在 MA20 上，越高越强，越低越弱 */
  score: number
  signal: 'buy' | 'hold' | 'sell'
}

export interface RegimeSignal {
  /** 效率比率 0-1：接近1=趋势市，接近0=震荡市 */
  er: number
  regime: 'trend' | 'neutral' | 'range'
}

/**
 * 市场状态判断（效率比率 ER，Kaufman）：
 * ER = |N日净涨跌| / N日累计波动路径。
 * - ER ≥ 0.4 → 趋势市（MA20策略适合）
 * - ER < 0.2 → 震荡市（MA20策略容易被来回打脸）
 * - 中间 → 中性
 * 注：衡量的是近 N 日的状态，不是预测。
 */
export function computeRegime(bars: KLine[], period = 20): RegimeSignal {
  if (bars.length < period + 1) return { er: 0.5, regime: 'neutral' }
  const closes = bars.slice(-period - 1).map(b => b.close)
  const netMove = Math.abs(closes[closes.length - 1] - closes[0])
  let pathLength = 0
  for (let i = 1; i < closes.length; i++) {
    pathLength += Math.abs(closes[i] - closes[i - 1])
  }
  const er = pathLength > 0 ? netMove / pathLength : 0
  const regime: RegimeSignal['regime'] = er >= 0.4 ? 'trend' : er < 0.2 ? 'range' : 'neutral'
  return { er, regime }
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
