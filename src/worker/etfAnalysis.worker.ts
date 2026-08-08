import type { Signal, ETFInfo, LearningConfig, LearningLog } from '../types'
import { scoreETF } from '../engine/etf/scorer'
import { learnFromHistory } from '../engine/etf/learner'
import { runBacktest, optimizeAll } from '../engine/etf/backtest'
import { fetchAllETFs } from '../data/etfFetcher'
import { getKLines, saveKLines, saveSignal, getWeights, saveWeights, saveLearningLog, getSetting } from '../data/db'
import { DEFAULT_ETF_WEIGHTS, DEFAULT_SIGNAL_THRESHOLDS, DEFAULT_LEARNING_CONFIG } from '../config/defaults'

type WorkerMessage =
  | { type: 'learn'; etfCode: string; config?: LearningConfig }
  | { type: 'refresh'; etfs: ETFInfo[] }
  | { type: 'backtest'; etfCode: string; buyThreshold: number; sellThreshold: number }
  | { type: 'optimizeAll'; etfCode: string }

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data
  try {
    if (msg.type === 'learn') {
      const { etfCode, config } = msg
      const cfg = config ?? DEFAULT_LEARNING_CONFIG
      const oldWeights = await getWeights('etf') ?? { ...DEFAULT_ETF_WEIGHTS }
      const bars = await getKLines(etfCode)
      if (bars.length < 70) {
        self.postMessage({ type: 'error', message: `数据不足：${bars.length}天，需≥70天` })
        return
      }
      const result = learnFromHistory(bars, oldWeights, cfg, 5)
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

    } else if (msg.type === 'refresh') {
      const { etfs } = msg
      const data = await fetchAllETFs(etfs)
      for (const [code, bars] of data) {
        if (bars.length > 0) await saveKLines(code, bars)
      }
      const signals: Signal[] = []
      for (const etf of etfs) {
        let bars = await getKLines(etf.code)
        if (bars.length === 0) continue
        let weights = await getWeights('etf')
        if (!weights) { weights = { ...DEFAULT_ETF_WEIGHTS }; await saveWeights('etf', weights) }
        const savedBuy = await getSetting<number>('buyThreshold')
        const savedSell = await getSetting<number>('sellThreshold')
        const effective = (savedBuy && savedSell) ? { buyThreshold: savedBuy, sellThreshold: savedSell } : DEFAULT_SIGNAL_THRESHOLDS
        const result = scoreETF(bars, weights, effective)
        let finalSignal = result.signal
        if (bars.length >= 8) {
          const ma5Now = bars.slice(-5).reduce((s: number, b: any) => s + b.close, 0) / 5
          const ma5Prev = bars.slice(-8, -3).reduce((s: number, b: any) => s + b.close, 0) / 5
          if (result.signal === 'buy' && ma5Now <= ma5Prev) finalSignal = 'hold'
          if (result.signal === 'sell' && ma5Now >= ma5Prev) finalSignal = 'hold'
        }
        const signal: Signal = { id: `etf-${etf.code}-${new Date().toISOString().slice(0, 10)}`, etfCode: etf.code, date: new Date().toISOString().slice(0, 10), compositeScore: result.compositeScore, signal: finalSignal, factorScores: result.factorScores, weights: result.weights }
        await saveSignal(signal)
        signals.push(signal)
      }
      self.postMessage({ type: 'analysisComplete', signals })

    } else if (msg.type === 'backtest') {
      const { etfCode, buyThreshold, sellThreshold } = msg
      const bars = await getKLines(etfCode)
      if (bars.length < 80) {
        self.postMessage({ type: 'error', message: `需要至少80天K线数据，当前${bars.length}天` })
        return
      }
      const weights = await getWeights('etf') ?? { ...DEFAULT_ETF_WEIGHTS }
      const result = runBacktest(bars, weights, { buyThreshold, sellThreshold }, 100000)
      self.postMessage({ type: 'backtestResult', result })

    } else if (msg.type === 'optimizeAll') {
      const { etfCode } = msg
      const bars = await getKLines(etfCode)
      if (bars.length < 80) {
        self.postMessage({ type: 'error', message: `需要至少80天K线数据，当前${bars.length}天` })
        return
      }
      const opt = optimizeAll(bars)
      self.postMessage({
        type: 'optimizeAllResult',
        bestWeights: opt.bestWeights,
        bestBuy: opt.bestBuy,
        bestSell: opt.bestSell,
        result: opt.bestResult,
      })
    }

  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
