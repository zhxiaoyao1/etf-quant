import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { saveETFList, getETFList, saveKLines, getKLines, saveSignal, getSignals } from '../../src/data/db'
import type { ETFInfo, KLine, Signal } from '../../src/types'

beforeEach(() => {
  indexedDB = new IDBFactory()
})

describe('ETF List CRUD', () => {
  it('saves and retrieves ETF list', async () => {
    const etfs: ETFInfo[] = [
      { code: '510300', name: '沪深300ETF', market: 'SH' },
      { code: '159915', name: '创业板ETF', market: 'SZ' },
    ]
    await saveETFList(etfs)
    const result = await getETFList()
    expect(result).toHaveLength(2)
    const codes = result.map(e => e.code).sort()
    expect(codes).toEqual(['159915', '510300'])
  })
})

describe('K-line Data CRUD', () => {
  it('saves and retrieves K-line data', async () => {
    const bars: KLine[] = [
      { date: '2026-07-10', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
    ]
    await saveKLines('510300', bars)
    const result = await getKLines('510300')
    expect(result).toHaveLength(1)
  })

  it('returns empty array for unknown ETF', async () => {
    const result = await getKLines('999999')
    expect(result).toEqual([])
  })
})

describe('Signal CRUD', () => {
  it('saves and retrieves signals', async () => {
    const signal: Signal = {
      id: 'test-1',
      etfCode: '510300',
      date: '2026-07-15',
      compositeScore: 82,
      signal: 'buy',
      factorScores: [
        { factorId: 'trend', name: '趋势', score: 85 },
      ],
      weights: { trend: 1.0 },
    }
    await saveSignal(signal)
    const results = await getSignals({ etfCode: '510300', limit: 10 })
    expect(results).toHaveLength(1)
    expect(results[0].signal).toBe('buy')
  })
})
