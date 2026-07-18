import type { Signal, ETFInfo, SignalThresholds, LearningConfig, LearningLog } from '../types'
import { scoreETF } from '../engine/etf/scorer'
import { learnFromHistory } from '../engine/etf/learner'
import { runBacktest, optimizeThresholds, optimizeAll } from '../engine/etf/backtest'
import { fetchAllETFs } from '../data/etfFetcher'
import { getKLines, saveKLines, saveSignal, getWeights, saveWeights, saveLearningLog, getSetting } from '../data/db'
import { DEFAULT_ETF_WEIGHTS, DEFAULT_SIGNAL_THRESHOLDS, DEFAULT_LEARNING_CONFIG } from '../config/defaults'

type WorkerMessage =
  | { type: 'analyze'; etfs: ETFInfo[]; thresholds?: SignalThresholds }
  | { type: 'learn'; etfCode: string; config?: LearningConfig }
  | { type: 'fetchAndStore'; etfs: ETFInfo[] }
  | { type: 'backtest'; etfCode: string; buyThreshold: number; sellThreshold: number; options?: Record<string, any>; benchmarkCode?: string }
  | { type: 'optimize'; etfCode: string }
  | { type: 'optimizeAll'; etfCode: string }

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
        const savedBuy = await getSetting<number>('buyThreshold')
        const savedSell = await getSetting<number>('sellThreshold')
        const effective = thresholds ?? ((savedBuy && savedSell) ? { buyThreshold: savedBuy, sellThreshold: savedSell } : DEFAULT_SIGNAL_THRESHOLDS)
        const result = scoreETF(bars, weights, effective)

        // MA5 趋势过滤：信号方向必须与价格趋势一致
        let finalSignal = result.signal
        if (bars.length >= 8) {
          const last5 = bars.slice(-5)
          const prev5 = bars.slice(-8, -3)
          const ma5Now = last5.reduce((s, b) => s + b.close, 0) / 5
          const ma5Prev = prev5.reduce((s, b) => s + b.close, 0) / 5
          const trendUp = ma5Now > ma5Prev
          const trendDown = ma5Now < ma5Prev
          // 买入信号但价格在跌 → 降级为观望
          if (result.signal === 'buy' && !trendUp) finalSignal = 'hold'
          // 卖出信号但价格在涨 → 降级为观望
          if (result.signal === 'sell' && !trendDown) finalSignal = 'hold'
        }

        const signal: Signal = {
          id: `etf-${etf.code}-${new Date().toISOString().slice(0, 10)}`,
          etfCode: etf.code,
          date: new Date().toISOString().slice(0, 10),
          compositeScore: result.compositeScore,
          signal: finalSignal,
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
      const { etfCode, buyThreshold, sellThreshold, options, benchmarkCode } = msg
      const bars = await getKLines(etfCode)
      if (bars.length < 80) {
        self.postMessage({ type: 'error', message: `需要至少80天K线数据，当前${bars.length}天` })
        return
      }
      // 大盘择时：取基准ETF的K线
      let benchmarkBars: any[] | undefined
      if (benchmarkCode) {
        benchmarkBars = await getKLines(benchmarkCode)
      }
      const weights = options?.manualWeights ?? await getWeights('etf') ?? { ...DEFAULT_ETF_WEIGHTS }
      const opts = { ...(options ?? {}), benchmarkBars }
      const result = runBacktest(bars, weights, { buyThreshold, sellThreshold }, 100000, opts)
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
