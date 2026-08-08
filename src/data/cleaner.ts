import type { KLine } from '../types'

/** Filter invalid data: open/high/low/close must be positive, volume must be >= 0 */
export function cleanKLines(bars: KLine[]): KLine[] {
  return bars
    .filter(bar =>
      bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0 && bar.volume >= 0
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Deduplicate: keep first occurrence per date */
export function removeDuplicates(bars: KLine[]): KLine[] {
  const seen = new Set<string>()
  return bars.filter(bar => {
    if (seen.has(bar.date)) return false
    seen.add(bar.date)
    return true
  })
}

/** Cleaning pipeline: deduplicate -> filter -> sort（不补假K线，空档交给图表库处理） */
export function processKLines(bars: KLine[]): KLine[] {
  return cleanKLines(removeDuplicates(bars))
}
