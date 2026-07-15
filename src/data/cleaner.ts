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

/** Forward-fill weekend/holiday gaps */
export function fillMissingDates(bars: KLine[]): KLine[] {
  if (bars.length < 2) return bars
  const result: KLine[] = [bars[0]]
  for (let i = 1; i < bars.length; i++) {
    const prev = new Date(bars[i - 1].date)
    const curr = new Date(bars[i].date)
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 1 && diffDays <= 2) {
      for (let d = 1; d < diffDays; d++) {
        const fillDate = new Date(prev.getTime() + d * 86400000)
        result.push({
          date: fillDate.toISOString().slice(0, 10),
          open: bars[i - 1].close,
          high: bars[i - 1].close,
          low: bars[i - 1].close,
          close: bars[i - 1].close,
          volume: 0,
        })
      }
    }
    result.push(bars[i])
  }
  return result
}

/** Cleaning pipeline: deduplicate -> filter -> sort -> fill */
export function processKLines(bars: KLine[]): KLine[] {
  return fillMissingDates(cleanKLines(removeDuplicates(bars)))
}
