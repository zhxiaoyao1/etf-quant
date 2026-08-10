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

/** 布林带最新值：上轨/中轨/下轨（基于近 period 根收盘价） */
export function bollingerLast(bars: KLine[], period = 20, stdDev = 2): { upper: number; middle: number; lower: number } {
  if (bars.length < period) return { upper: 0, middle: 0, lower: 0 }
  const closes = bars.slice(-period).map(b => b.close)
  const mean = closes.reduce((s, v) => s + v, 0) / period
  const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period
  const std = Math.sqrt(variance)
  return { upper: mean + stdDev * std, middle: mean, lower: mean - stdDev * std }
}

