import type { KLine, ETFInfo } from '../types'
import { processKLines } from './cleaner'

function buildKLineUrl(code: string, market: 'SH' | 'SZ'): string {
  const secid = market === 'SH' ? `1.${code}` : `0.${code}`
  return `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt=800`
}

function parseEastMoneyKLine(raw: unknown): KLine[] {
  const data = raw as {
    data?: { klines?: string[] }
  }
  if (!data?.data?.klines) return []
  return data.data.klines.map((line: string) => {
    const parts = line.split(',')
    return {
      date: parts[0],
      open: parseFloat(parts[1]),
      close: parseFloat(parts[2]),
      high: parseFloat(parts[3]),
      low: parseFloat(parts[4]),
      volume: parseInt(parts[5], 10),
    }
  })
}

export async function fetchETFKLines(
  code: string,
  market: 'SH' | 'SZ'
): Promise<KLine[]> {
  const url = buildKLineUrl(code, market)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch K-lines for ${code}: ${response.status}`)
  }
  const raw = await response.json()
  const bars = parseEastMoneyKLine(raw)
  return processKLines(bars)
}

export async function fetchAllETFs(etfs: ETFInfo[]): Promise<Map<string, KLine[]>> {
  const results = new Map<string, KLine[]>()
  for (const etf of etfs) {
    try {
      const bars = await fetchETFKLines(etf.code, etf.market)
      results.set(etf.code, bars)
    } catch (err) {
      console.error(`Failed to fetch ${etf.code}:`, err)
      results.set(etf.code, [])
    }
  }
  return results
}

export function needsUpdate(existingBars: KLine[], fetchedBars: KLine[]): boolean {
  if (existingBars.length === 0) return true
  const latestExisting = existingBars[existingBars.length - 1].date
  const latestFetched = fetchedBars[fetchedBars.length - 1].date
  return latestFetched > latestExisting
}
