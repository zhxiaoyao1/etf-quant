import type { Signal, ETFInfo, SignalThresholds, LearningConfig, LearningLog } from '../types'
import { scoreETF } from '../engine/etf/scorer'
import { adjustWeights } from '../engine/etf/learner'
import { runBacktest, optimizeThresholds } from '../engine/etf/backtest'
import { fetchAllETFs } from '../data/etfFetcher'
import { getKLines, saveKLines, saveSignal, getSignals, getWeights, saveWeights, saveLearningLog } from '../data/db'
import { DEFAULT_ETF_WEIGHTS, DEFAULT_SIGNAL_THRESHOLDS, DEFAULT_LEARNING_CONFIG } from '../config/defaults'

type WorkerMessage =
  | { type: 'analyze'; etfs: ETFInfo[]; thresholds?: SignalThresholds }
  | { type: 'learn'; etfCode: string; config?: LearningConfig }
  | { type: 'fetchAndStore'; etfs: ETFInfo[] }
  | { type: 'backtest'; etfCode: string; buyThreshold: number; sellThreshold: number }
  | { type: 'optimize'; etfCode: string }

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data
  try {
    if (msg.type === 'analyze') {
      const { etfs, thresholds } = msg
      const signals: Signal[] = []
      for (const etf of etfs) {
        let bars = await getKLines(etf.code)
        if (bars.length === 0) continue
        let weights = await getWeights('etf')
        if (!weights) {
          weights = { ...DEFAULT_ETF_WEIGHTS }
          await saveWeights('etf', weights)
        }
        const result = scoreETF(bars, weights, thresholds ?? DEFAULT_SIGNAL_THRESHOLDS)
        const signal: Signal = {
          id: `etf-${etf.code}-${new Date().toISOString().slice(0, 10)}`,
          etfCode: etf.code,
          date: new Date().toISOString().slice(0, 10),
          compositeScore: result.compositeScore,
          signal: result.signal,
          factorScores: result.factorScores,
          weights: result.weights,
        }
        await saveSignal(signal)
        signals.push(signal)
      }
      self.postMessage({ type: 'analysisComplete', signals })

    } else if (msg.type === 'learn') {
      const { etfCode, config } = msg
      const cfg = config ?? DEFAULT_LEARNING_CONFIG
      const signals = await getSignals({ etfCode, limit: cfg.lookbackWindow })
      const oldWeights = await getWeights('etf') ?? { ...DEFAULT_ETF_WEIGHTS }
      const bars = await getKLines(etfCode)
      if (bars.length < 2) {
        self.postMessage({ type: 'error', message: 'Not enough K-line data' })
        return
      }
      const recent5 = bars.slice(-5)
      const prev5 = bars.slice(-10, -5)
      const recentAvg = recent5.reduce((s, b) => s + b.close, 0) / recent5.length
      const prevAvg = prev5.reduce((s, b) => s + b.close, 0) / prev5.length
      const actualOutcome = recentAvg > prevAvg ? 'up' : 'down'
      const result = adjustWeights(signals, actualOutcome, oldWeights, cfg)
      await saveWeights('etf', result.newWeights)
      const log: LearningLog = {
        id: `learn-etf-${etfCode}-${new Date().toISOString().slice(0, 10)}`,
        date: new Date().toISOString().slice(0, 10),
        engine: 'etf',
        oldWeights: { ...oldWeights },
        newWeights: { ...result.newWeights },
        factorAccuracies: { ...result.factorAccuracies },
        sampleCount: result.sampleCount,
      }
      await saveLearningLog(log)
      self.postMessage({ type: 'learnComplete', log })

    } else if (msg.type === 'fetchAndStore') {
      const { etfs } = msg
      const data = await fetchAllETFs(etfs)
      let count = 0
      for (const [code, bars] of data) {
        if (bars.length > 0) {
          await saveKLines(code, bars)
          count++
        }
      }
      self.postMessage({ type: 'fetchComplete', count })

    } else if (msg.type === 'backtest') {
      const { etfCode, buyThreshold, sellThreshold } = msg
      const bars = await getKLines(etfCode)
      if (bars.length < 80) {
        self.postMessage({ type: 'error', message: `需要至少80天K线数据，当前${bars.length}天` })
        return
      }
      const weights = await getWeights('etf') ?? { ...DEFAULT_ETF_WEIGHTS }
      const result = runBacktest(bars, weights, { buyThreshold, sellThreshold })
      self.postMessage({ type: 'backtestResult', result })

    } else if (msg.type === 'optimize') {
      const { etfCode } = msg
      const bars = await getKLines(etfCode)
      if (bars.length < 80) {
        self.postMessage({ type: 'error', message: `需要至少80天K线数据，当前${bars.length}天` })
        return
      }
      const weights = await getWeights('etf') ?? { ...DEFAULT_ETF_WEIGHTS }
      const opt = optimizeThresholds(bars, weights)
      self.postMessage({ type: 'optimizeResult', bestBuy: opt.bestBuy, bestSell: opt.bestSell, result: opt.bestResult })
    }

  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
