import { useRef, useCallback, useState } from 'react'
import type { ETFInfo, Signal } from '../types'

function createWorker(): Worker {
  return new Worker(
    new URL('../worker/etfAnalysis.worker.ts', import.meta.url),
    { type: 'module' }
  )
}

export function useETFWorker() {
  const refreshWorkerRef = useRef<Worker | null>(null)
  const [loading, setLoading] = useState(false)

  // 刷新用共享 Worker（复用，不新建，速度快）
  const refresh = useCallback(
    (etfs: ETFInfo[]): Promise<Signal[]> => {
      return new Promise((resolve, reject) => {
        if (!refreshWorkerRef.current) {
          refreshWorkerRef.current = createWorker()
        }
        const worker = refreshWorkerRef.current
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          if (e.data.type === 'analysisComplete') resolve(e.data.signals)
          else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => { setLoading(false); reject(err) }
        worker.postMessage({ type: 'refresh', etfs })
      })
    },
    []
  )

  const backtest = useCallback(
    (etfCode: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        const worker = createWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          worker.terminate()
          if (e.data.type === 'backtestResult') resolve(e.data.result)
          else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => { setLoading(false); worker.terminate(); reject(err) }
        worker.postMessage({ type: 'backtest', etfCode })
      })
    },
    []
  )

  return { refresh, backtest, loading }
}
