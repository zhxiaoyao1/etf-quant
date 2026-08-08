import type { Signal, ETFInfo } from '../types'
import { computeTrendSignal } from '../engine/etf/trendSignal'
import { runBacktest } from '../engine/etf/backtest'
import { fetchAllETFs } from '../data/etfFetcher'
import { getKLines, saveKLines, saveSignal } from '../data/db'

type WorkerMessage =
  | { type: 'refresh'; etfs: ETFInfo[] }
  | { type: 'backtest'; etfCode: string }

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data
  try {
    if (msg.type === 'refresh') {
      const { etfs } = msg
      const data = await fetchAllETFs(etfs)
      for (const [code, bars] of data) {
        if (bars.length > 0) await saveKLines(code, bars)
      }
      const signals: Signal[] = []
      for (const etf of etfs) {
        const bars = await getKLines(etf.code)
        if (bars.length < 20) continue
        const t = computeTrendSignal(bars)
        const signal: Signal = {
          id: `etf-${etf.code}-${new Date().toISOString().slice(0, 10)}`,
          etfCode: etf.code,
          date: new Date().toISOString().slice(0, 10),
          score: t.score,
          signal: t.signal,
        }
        await saveSignal(signal)
        signals.push(signal)
      }
      self.postMessage({ type: 'analysisComplete', signals })

    } else if (msg.type === 'backtest') {
      const { etfCode } = msg
      const bars = await getKLines(etfCode)
      if (bars.length < 40) {
        self.postMessage({ type: 'error', message: `需要至少40天K线数据，当前${bars.length}天` })
        return
      }
      const result = runBacktest(bars)
      self.postMessage({ type: 'backtestResult', result })
    }

  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
