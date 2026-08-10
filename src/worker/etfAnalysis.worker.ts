import type { Signal, ETFInfo } from '../types'
import { computeDualSignal } from '../engine/etf/trendSignal'
import { fetchAllETFs } from '../data/etfFetcher'
import { getKLines, saveKLines, saveSignal, getSetting } from '../data/db'

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
      // 手动模式覆盖（每只ETF可选 自动/抄底/顺势）
      const overrides = (await getSetting<Record<string, 'auto' | 'trend' | 'range'>>('modeOverrides')) ?? {}
      const signals: Signal[] = []
      for (const etf of etfs) {
        const bars = await getKLines(etf.code)
        if (bars.length < 20) continue
        const ov = overrides[etf.code]
        const forced = ov === 'trend' || ov === 'range' ? ov : undefined
        const d = computeDualSignal(bars, 20, forced)
        const signal: Signal = {
          id: `etf-${etf.code}-${new Date().toISOString().slice(0, 10)}`,
          etfCode: etf.code,
          date: new Date().toISOString().slice(0, 10),
          score: d.score,
          signal: d.signal,
          mode: d.mode,
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
