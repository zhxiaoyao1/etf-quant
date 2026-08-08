import type { KLine } from '../types'

/**
 * Compute the last simple moving average value from an array of numbers.
 */
export function sma(values: number[], period: number): number {
  if (values.length < period) return 0
  let sum = 0
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i]
  }
  return sum / period
}

/**
 * Compute the full simple moving average series from an array of numbers.
 * The first `period - 1` entries are excluded from the result.
 */
export function smaSeries(values: number[], period: number): number[] {
  const result: number[] = []
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j]
    }
    result.push(sum / period)
  }
  return result
}

/** Clamp a number into [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 冲高回落形态惩罚：最新一根日K长上影且收在低位 → 返回 0~10 的扣分。
 * 上影线占比越大、收盘位置越低，扣分越多。
 */
export function reversalCandlePenalty(bar: KLine): number {
  const range = bar.high - bar.low
  if (range <= 0) return 0
  const upperWick = (bar.high - Math.max(bar.open, bar.close)) / range
  const closePos = (bar.close - bar.low) / range
  if (upperWick > 0.5 && closePos < 0.3) {
    return clamp((upperWick - 0.5) * 20 + (0.3 - closePos) * 20, 0, 10)
  }
  return 0
}

/**
 * Average True Range (ATR): simple average of True Range over the last `period` bars.
 * True Range = max(high-low, |high-prevClose|, |low-prevClose|), capturing gaps.
 * Returns 0 if there is insufficient data.
 */
export function atr(bars: KLine[], period: number): number {
  if (bars.length < period + 1) return 0
  const slice = bars.slice(-period)
  let sum = 0
  for (let i = 1; i < slice.length; i++) {
    const high = slice[i].high
    const low = slice[i].low
    const prevClose = slice[i - 1].close
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    sum += tr
  }
  return sum / period
}
