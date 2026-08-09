import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import 'fake-indexeddb/auto'
import Detail from '../../src/ui/Detail'
import { saveKLines, saveETFList, saveSignal } from '../../src/data/db'
import type { KLine, Signal } from '../../src/types'

// jsdom 无 canvas → mock lightweight-charts
const fakeSeries = () => ({ setData: vi.fn(), setMarkers: vi.fn() })
const fakeChart = {
  addCandlestickSeries: () => fakeSeries(),
  addLineSeries: () => fakeSeries(),
  remove: vi.fn(),
  applyOptions: vi.fn(),
  timeScale: () => ({ fitContent: vi.fn() }),
}
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => fakeChart),
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dashed: 1 },
}))

// jsdom 无 ResizeObserver
class MockRO {
  observe() {}
  disconnect() {}
  unobserve() {}
}
;(globalThis as any).ResizeObserver = MockRO

function makeBars(n: number): KLine[] {
  const bars: KLine[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(2026, 0, 1)
    d.setDate(d.getDate() + i)
    bars.push({
      date: d.toISOString().slice(0, 10),
      open: 10 + i * 0.1,
      high: 10 + i * 0.12,
      low: 10 + i * 0.08,
      close: 10 + i * 0.1,
      volume: 1000,
    })
  }
  return bars
}

describe('Detail 渲染（临时诊断）', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory()
  })

  it('renders without crashing with NEW-format signal', async () => {
    await saveETFList([{ code: '510300', name: '沪深300ETF', market: 'SH' }])
    await saveKLines('510300', makeBars(80))
    const signal: Signal = { id: 's1', etfCode: '510300', date: '2026-08-07', score: 60, signal: 'buy' }
    await saveSignal(signal)
    render(<Detail />)
    await waitFor(() => expect(screen.queryByText(/沪深300ETF/)).toBeTruthy())
    expect(screen.queryByText(/回测/)).toBeTruthy()
  })

  it('renders without crashing with OLD-format signal (factor-era data)', async () => {
    await saveETFList([{ code: '510300', name: '沪深300ETF', market: 'SH' }])
    await saveKLines('510300', makeBars(80))
    // 旧格式：compositeScore/factorScores/weights，没有 score
    const oldSignal = {
      id: 's2',
      etfCode: '510300',
      date: '2026-08-07',
      compositeScore: 82,
      signal: 'buy',
      factorScores: [{ factorId: 'trend', name: '趋势', score: 85 }],
      weights: { trend: 1.0 },
    }
    await saveSignal(oldSignal as unknown as Signal)
    render(<Detail />)
    await waitFor(() => expect(screen.queryByText(/沪深300ETF/)).toBeTruthy())
    expect(screen.queryByText(/回测/)).toBeTruthy()
  })
})
