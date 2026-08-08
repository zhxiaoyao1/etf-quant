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

/**
 * 布林带宽序列（%）：(上轨-下轨)/中轨×100，衡量波动扩张/收窄。
 * 前 `period-1` 个位置为 NaN（数据不足）。
 */
export function bollingerWidth(bars: KLine[], period = 20, stdDev = 2): number[] {
  const result: number[] = []
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      result.push(Number.NaN)
      continue
    }
    const slice = bars.slice(i - period + 1, i + 1)
    const closes = slice.map(b => b.close)
    const mean = closes.reduce((s, v) => s + v, 0) / period
    if (mean <= 0) {
      result.push(Number.NaN)
      continue
    }
    const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period
    const std = Math.sqrt(variance)
    const upper = mean + stdDev * std
    const lower = mean - stdDev * std
    result.push(((upper - lower) / mean) * 100)
  }
  return result
}

/**
 * 带宽是否在扩张：第 i 天的带宽 > 近 avgWindow 天的平均带宽。
 * 有效数据不足时返回 false。
 */
export function bandExpanding(widths: number[], i: number, avgWindow = 20): boolean {
  if (i < avgWindow || Number.isNaN(widths[i])) return false
  let sum = 0
  let count = 0
  for (let k = i - avgWindow; k < i; k++) {
    if (!Number.isNaN(widths[k])) {
      sum += widths[k]
      count++
    }
  }
  if (count < 5) return false
  return widths[i] > sum / count
}
