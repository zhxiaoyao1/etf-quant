import { useRef, useCallback, useState } from 'react'
import type { ETFInfo, Signal, LearningLog } from '../types'

export function useETFWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [loading, setLoading] = useState(false)

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../worker/etfAnalysis.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return workerRef.current
  }, [])

  const fetchAndStore = useCallback(
    (etfs: ETFInfo[]): Promise<number> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          if (e.data.type === 'fetchComplete') resolve(e.data.count)
          else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => { setLoading(false); reject(err) }
        worker.postMessage({ type: 'fetchAndStore', etfs })
      })
    },
    [getWorker]
  )

  const analyze = useCallback(
    (etfs: ETFInfo[]): Promise<Signal[]> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          if (e.data.type === 'analysisComplete') resolve(e.data.signals)
          else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => { setLoading(false); reject(err) }
        worker.postMessage({ type: 'analyze', etfs })
      })
    },
    [getWorker]
  )

  const learn = useCallback(
    (etfCode: string): Promise<LearningLog> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          if (e.data.type === 'learnComplete') resolve(e.data.log)
          else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => { setLoading(false); reject(err) }
        worker.postMessage({ type: 'learn', etfCode })
      })
    },
    [getWorker]
  )

  return { fetchAndStore, analyze, learn, loading }
}
