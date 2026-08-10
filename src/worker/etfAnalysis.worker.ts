import type { Signal, ETFInfo } from '../types'
import { computeDualSignal } from '../engine/etf/trendSignal'
import { fetchAllETFs } from '../data/etfFetcher'
import { getKLines, saveKLines, saveSignal } from '../data/db'

type WorkerMessage = { type: 'refresh'; etfs: ETFInfo[] }

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
        const d = computeDualSignal(bars)
        const signal: Signal = {
          id: `etf-${etf.code}-${new Date().toISOString().slice(0, 10)}`,
          etfCode: etf.code,
          date: new Date().toISOString().slice(0, 10),
          score: d.score,
          signal: d.signal,
        }
        await saveSignal(signal)
        signals.push(signal)
      }
      self.postMessage({ type: 'analysisComplete', signals })
    }

  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
