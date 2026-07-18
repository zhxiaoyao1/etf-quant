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
