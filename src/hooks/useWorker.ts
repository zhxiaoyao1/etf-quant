import { useRef, useCallback, useState } from 'react'
import type { ETFInfo, Signal, LearningLog } from '../types'

function createWorker(): Worker {
  return new Worker(
    new URL('../worker/etfAnalysis.worker.ts', import.meta.url),
    { type: 'module' }
  )
}

export function useETFWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [loading, setLoading] = useState(false)

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = createWorker()
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

  // 回测和寻优各用独立 Worker，避免消息处理冲突
  const backtest = useCallback(
    (etfCode: string, buyThreshold: number, sellThreshold: number): Promise<any> => {
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
        worker.postMessage({ type: 'backtest', etfCode, buyThreshold, sellThreshold })
      })
    },
    []
  )

  const optimize = useCallback(
    (etfCode: string): Promise<{ bestBuy: number; bestSell: number; result: any }> => {
      return new Promise((resolve, reject) => {
        const worker = createWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          worker.terminate()
          if (e.data.type === 'optimizeResult') {
            resolve({ bestBuy: e.data.bestBuy, bestSell: e.data.bestSell, result: e.data.result })
          } else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => { setLoading(false); worker.terminate(); reject(err) }
        worker.postMessage({ type: 'optimize', etfCode })
      })
    },
    []
  )

  const optimizeAll = useCallback(
    (etfCode: string): Promise<{ bestWeights: Record<string, number>; bestBuy: number; bestSell: number; result: any }> => {
      return new Promise((resolve, reject) => {
        const worker = createWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          worker.terminate()
          if (e.data.type === 'optimizeAllResult') {
            resolve({ bestWeights: e.data.bestWeights, bestBuy: e.data.bestBuy, bestSell: e.data.bestSell, result: e.data.result })
          } else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => { setLoading(false); worker.terminate(); reject(err) }
        worker.postMessage({ type: 'optimizeAll', etfCode })
      })
    },
    []
  )

  return { fetchAndStore, analyze, learn, backtest, optimize, optimizeAll, loading }
}
