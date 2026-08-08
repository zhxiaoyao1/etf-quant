import type { KLine } from '../../types'
import { sma, atr, clamp } from '../common'

/** MA20 均线周期 */
export const MA_PERIOD = 20
/** ATR 周期 */
export const ATR_PERIOD = 14

export interface TrendSignal {
  /** 趋势分 0-100：50 = 收盘价正好在 MA20 上，越高越强，越低越弱 */
  score: number
  signal: 'buy' | 'hold' | 'sell'
  ma20: number
  atr: number
}

/**
 * 纯趋势跟随信号：只用"收盘价相对 MA20 的位置"判断多空。
 * - score > 50：收盘价在 MA20 上方（看多）
 * - score < 50：收盘价在 MA20 下方（看空）
 * 没有任何因子打分、权重、阈值，逻辑一眼看懂。
 */
export function computeTrendSignal(
  bars: KLine[],
  maPeriod: number = MA_PERIOD,
  atrPeriod: number = ATR_PERIOD
): TrendSignal {
  if (bars.length < maPeriod) {
    const close = bars[bars.length - 1]?.close ?? 0
    return { score: 50, signal: 'hold', ma20: close, atr: 0 }
  }
  const closes = bars.map(b => b.close)
  const ma20 = sma(closes, maPeriod)
  const a = atr(bars, atrPeriod)
  const close = bars[bars.length - 1].close
  if (ma20 <= 0) return { score: 50, signal: 'hold', ma20, atr: a }

  // 偏离度映射：±2% 对应 ±10 分，10% 以上打满
  const score = clamp(Math.round(50 + ((close - ma20) / ma20) * 500), 0, 100)
  const signal: TrendSignal['signal'] = score > 50 ? 'buy' : score < 50 ? 'sell' : 'hold'
  return { score, signal, ma20, atr: a }
}
