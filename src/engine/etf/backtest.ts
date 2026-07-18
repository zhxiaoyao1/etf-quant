import type { KLine, SignalThresholds } from '../../types'
import { scoreETF } from './scorer'
import { DEFAULT_SIGNAL_THRESHOLDS } from '../../config/defaults'
import { sma } from '../common'

export interface BacktestTrade {
  buyDate: string
  buyPrice: number
  sellDate: string | null  // null if still holding
  sellPrice: number | null
  return: number | null     // fractional return
  holdDays: number | null
}

export interface BacktestResult {
  totalReturn: number        // e.g. 0.25 = 25%
  annualizedReturn: number
  maxDrawdown: number        // e.g. -0.15 = -15%
  sharpeRatio: number
  winRate: number           // fraction of winning trades
  totalTrades: number
  winningTrades: number
  equityCurve: { date: string; value: number }[]
  trades: BacktestTrade[]
  buyAndHoldReturn: number  // benchmark
  finalWeights?: Record<string, number>
}

/**
 * Run backtest on historical K-line data
 * @param bars K-line data (must be sorted by date ascending)
 * @param weights Factor weights to use
 * @param thresholds Signal thresholds (default: buy>=80, sell<40)
 * @param initialCapital Starting capital (default: 100000)
 */
export interface BacktestOptions {
  useLearning?: boolean     // 每21天自动学习调整权重
  positionSizing?: boolean  // 根据信号强度动态仓位（非满仓进出）
  benchmarkBars?: KLine[]   // 大盘K线（如沪深300），用于宏观择时过滤
}

export function runBacktest(
  bars: KLine[],
  weights: Record<string, number>,
  thresholds: SignalThresholds = DEFAULT_SIGNAL_THRESHOLDS,
  initialCapital: number = 100000,
  options: BacktestOptions = {}
): BacktestResult {
  const { useLearning = false, positionSizing = false, benchmarkBars } = options
  if (bars.length < 80) {
    return {
      totalReturn: 0, annualizedReturn: 0, maxDrawdown: 0,
      sharpeRatio: 0, winRate: 0, totalTrades: 0, winningTrades: 0,
      equityCurve: [], trades: [], buyAndHoldReturn: 0, finalWeights: undefined,
    }
  }

  let cash = initialCapital
  let shares = 0
  let holding = false
  let buyPrice = 0
  let buyDate = ''
  const trades: BacktestTrade[] = []
  const equityCurve: { date: string; value: number }[] = []
  const startIdx = 61
  let prevScore = 50

  if (bars.length > 60) {
    const initResult = scoreETF(bars.slice(0, 60), weights, thresholds)
    prevScore = initResult.compositeScore
  }


  const closePrices = bars.map(b => b.close)

  for (let i = startIdx; i < bars.length - 1; i++) {
    // 自学习：每21个交易日根据近期信心加权准确率调整权重
    if (useLearning && i > startIdx + 21 && (i - startIdx) % 21 === 0) {
      const factorIds = Object.keys(weights)
      const wScore: Record<string, number> = {}
      const wConf: Record<string, number> = {}
      for (const id of factorIds) { wScore[id] = 0; wConf[id] = 0 }
      for (let j = Math.max(startIdx, i - 21); j <= Math.min(i, bars.length - 6); j++) {
        const r = scoreETF(bars.slice(0, j + 1), weights, thresholds)
        const actualUp = bars[j + 5].close > bars[j].close
        for (const fs of r.factorScores) {
          const confidence = Math.abs(fs.score - 50) / 50
          wConf[fs.factorId] = (wConf[fs.factorId] ?? 0) + confidence
          wScore[fs.factorId] = (wScore[fs.factorId] ?? 0) + ((fs.score > 50) === actualUp ? confidence : -confidence)
        }
      }
      const acc: Record<string, number> = {}
      for (const id of factorIds) {
        acc[id] = (wConf[id] ?? 0) > 0 ? Math.max(0.05, ((wScore[id] ?? 0) / wConf[id] + 1) / 2) : 0.25
      }
      const sum = Object.values(acc).reduce((s, v) => s + v, 0) || 1
      for (const id of factorIds) {
        const raw = acc[id] / sum
        weights[id] = Math.max(0.1, Math.min(0.5, weights[id] * 0.5 + raw * 0.5))
      }
    }

    const windowBars = bars.slice(0, i + 1)
    const result = scoreETF(windowBars, weights, thresholds)
    const currentScore = result.compositeScore
    const currentPrice = bars[i].close

    // 趋势判断：MA5 斜率判断短期方向
    const maNow = sma(closePrices.slice(0, i + 1), 5)
    const maPrev = sma(closePrices.slice(0, i - 2), 5)
    const priceTrendUp = maNow > maPrev
    const priceTrendDown = maNow < maPrev

    // 买入：分数穿越买入线 + 价格大趋势向上
    const crossedBuy = prevScore < thresholds.buyThreshold && currentScore >= thresholds.buyThreshold
    const validBuy = crossedBuy && priceTrendUp

    // 卖出：分数穿越卖出线 + 价格大趋势向下
    const crossedSell = prevScore > thresholds.sellThreshold && currentScore <= thresholds.sellThreshold
    const validSell = crossedSell && priceTrendDown

    // 大盘择时：检查基准ETF的MA5趋势
    let marketOk = true
    if (benchmarkBars && benchmarkBars.length > i) {
      const bmLast5 = benchmarkBars.slice(Math.max(0, i - 4), i + 1)
      const bmPrev5 = benchmarkBars.slice(Math.max(0, i - 8), Math.max(0, i - 3))
      if (bmLast5.length >= 5 && bmPrev5.length >= 5) {
        const bmMaNow = bmLast5.reduce((s, b) => s + b.close, 0) / 5
        const bmMaPrev = bmPrev5.reduce((s, b) => s + b.close, 0) / 5
        marketOk = bmMaNow > bmMaPrev  // 大盘MA5向上才是好环境
      }
    }

    if (!holding && validBuy) {
      const nextOpen = bars[i + 1].open
      // 仓位：分数越高仓位越重，最低30%，最高100%
      let pct = positionSizing
        ? Math.min(1.0, Math.max(0.3, (currentScore - thresholds.buyThreshold) / (100 - thresholds.buyThreshold) * 0.7 + 0.3))
        : 1.0
      // 大盘下跌时仓位减半
      if (benchmarkBars && !marketOk) pct *= 0.5
      const investAmount = cash * pct
      shares = investAmount / nextOpen
      cash -= investAmount
      holding = true
      buyPrice = nextOpen
      buyDate = bars[i + 1].date
    }
    else if (holding && validSell) {
      // Sell at next day's open
      const nextOpen = bars[i + 1].open
      cash = shares * nextOpen
      const tradeReturn = (nextOpen - buyPrice) / buyPrice
      const holdDays = Math.round(
        (new Date(bars[i + 1].date).getTime() - new Date(buyDate).getTime()) / 86400000
      )
      trades.push({
        buyDate, buyPrice,
        sellDate: bars[i + 1].date,
        sellPrice: nextOpen,
        return: tradeReturn,
        holdDays,
      })
      shares = 0
      holding = false
    }

    // Track equity
    const equity = cash + shares * currentPrice
    equityCurve.push({ date: bars[i].date, value: equity })

    // Roll forward score history and holding counter
    prevScore = currentScore
  }

  // If still holding at end, close position
  if (holding && shares > 0) {
    const lastPrice = bars[bars.length - 1].close
    cash = shares * lastPrice
    const tradeReturn = (lastPrice - buyPrice) / buyPrice
    const holdDays = Math.round(
      (new Date(bars[bars.length - 1].date).getTime() - new Date(buyDate).getTime()) / 86400000
    )
    trades.push({
      buyDate, buyPrice,
      sellDate: bars[bars.length - 1].date,
      sellPrice: lastPrice,
      return: tradeReturn,
      holdDays,
    })
    equityCurve.push({ date: bars[bars.length - 1].date, value: cash })
  }

  // Calculate metrics
  const finalValue = cash + shares * bars[bars.length - 1].close
  const totalReturn = (finalValue - initialCapital) / initialCapital

  // Annualized return
  const tradingDays = bars.length - startIdx
  const years = tradingDays / 252
  const annualizedReturn = years > 0
    ? Math.pow(1 + totalReturn, 1 / years) - 1
    : 0

  // Max drawdown
  let maxDrawdown = 0
  let peakValue = initialCapital
  for (const point of equityCurve) {
    if (point.value > peakValue) peakValue = point.value
    const drawdown = (point.value - peakValue) / peakValue
    if (drawdown < maxDrawdown) maxDrawdown = drawdown
  }

  // Sharpe ratio (simplified: using daily returns)
  const dailyReturns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push(
      (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value
    )
  }
  const avgDailyReturn = dailyReturns.reduce((s, r) => s + r, 0) / (dailyReturns.length || 1)
  const stdDailyReturn = Math.sqrt(
    dailyReturns.reduce((s, r) => s + (r - avgDailyReturn) ** 2, 0) / (dailyReturns.length || 1)
  )
  const sharpeRatio = stdDailyReturn > 0
    ? (avgDailyReturn / stdDailyReturn) * Math.sqrt(252)
    : 0

  // Win rate
  const winningTrades = trades.filter(t => (t.return ?? 0) > 0).length
  const winRate = trades.length > 0 ? winningTrades / trades.length : 0

  // Buy & hold benchmark
  const firstPrice = bars[startIdx].close
  const lastPrice = bars[bars.length - 1].close
  const buyAndHoldReturn = (lastPrice - firstPrice) / firstPrice

  return {
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    sharpeRatio,
    winRate,
    totalTrades: trades.length,
    winningTrades,
    equityCurve,
    trades,
    buyAndHoldReturn,
    finalWeights: useLearning ? { ...weights } : undefined,
  }
}

export interface OptimizeResult {
  bestBuy: number
  bestSell: number
  bestResult: BacktestResult
  tested: number  // how many combinations tried
}

/**
 * Auto-optimize buy/sell thresholds
 * Tests combinations of buy (50-90 step 5) × sell (20-50 step 5)
 * Picks the one with highest total return that still has ≥3 trades
 */
export function optimizeThresholds(
  bars: KLine[],
  weights: Record<string, number>
): OptimizeResult {
  let bestBuy = 70
  let bestSell = 40
  let bestResult: BacktestResult | null = null
  let bestScore = -Infinity
  let tested = 0

  for (let buy = 40; buy <= 90; buy += 5) {
    for (let sell = 15; sell <= 55; sell += 5) {
      tested++
      const result = runBacktest(bars, weights, { buyThreshold: buy, sellThreshold: sell })
      // 评分：优先回报率，但要求至少3笔交易才有统计意义
      if (result.totalTrades >= 3) {
        // 综合评分：收益40% + 回撤控制40% + 夏普比率20%
        // 收益尽可能大，回撤尽可能小
        const score = result.totalReturn * 0.4 - Math.abs(result.maxDrawdown) * 0.4 + result.sharpeRatio * 0.2
        if (score > bestScore) {
          bestScore = score
          bestBuy = buy
          bestSell = sell
          bestResult = result
        }
      }
    }
  }

  if (!bestResult) {
    // 如果没有任何组合达到3笔交易，选交易最多的
    let maxTrades = 0
    for (let buy = 50; buy <= 90; buy += 5) {
      for (let sell = 20; sell <= 55; sell += 5) {
        tested++
        const result = runBacktest(bars, weights, { buyThreshold: buy, sellThreshold: sell })
        if (result.totalTrades > maxTrades) {
          maxTrades = result.totalTrades
          bestBuy = buy
          bestSell = sell
          bestResult = result
        }
      }
    }
  }

  return { bestBuy, bestSell, bestResult: bestResult!, tested }
}

/** 生成所有有效的权重组合（4因子，每因子10%-50%，步长10%，总和=100%） */
function* weightCombinations(): Generator<Record<string, number>> {
  const factors = ['trend', 'momentum', 'volatility', 'moneyFlow']
  for (let w1 = 10; w1 <= 50; w1 += 15) {
    for (let w2 = 10; w2 <= 50; w2 += 15) {
      for (let w3 = 10; w3 <= 50; w3 += 15) {
        const w4 = 100 - w1 - w2 - w3
        if (w4 >= 10 && w4 <= 50) {
          yield {
            [factors[0]]: w1 / 100,
            [factors[1]]: w2 / 100,
            [factors[2]]: w3 / 100,
            [factors[3]]: w4 / 100,
          }
        }
      }
    }
  }
}

export interface OptimizeAllResult {
  bestWeights: Record<string, number>
  bestBuy: number
  bestSell: number
  bestResult: BacktestResult
  tested: number
}

/** 同时优化因子权重 + 买卖阈值 */
export function optimizeAll(bars: KLine[]): OptimizeAllResult {
  let bestWeights: Record<string, number> = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
  let bestBuy = 70
  let bestSell = 40
  let bestResult: BacktestResult | null = null
  let bestScore = -Infinity
  let tested = 0

  for (const w of weightCombinations()) {
    for (let buy = 55; buy <= 85; buy += 10) {
      for (let sell = 25; sell <= 45; sell += 10) {
        tested++
        const result = runBacktest(bars, w, { buyThreshold: buy, sellThreshold: sell })
        if (result.totalTrades >= 3) {
          const score = result.totalReturn * 0.4 - Math.abs(result.maxDrawdown) * 0.4 + result.sharpeRatio * 0.2
          if (score > bestScore) {
            bestScore = score
            bestWeights = { ...w }
            bestBuy = buy
            bestSell = sell
            bestResult = result
          }
        }
      }
    }
  }

  if (!bestResult) {
    // fallback: 用默认权重优化阈值
    const fallback = optimizeThresholds(bars, { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 })
    return { bestWeights: { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }, bestBuy: fallback.bestBuy, bestSell: fallback.bestSell, bestResult: fallback.bestResult, tested: fallback.tested }
  }

  return { bestWeights, bestBuy, bestSell, bestResult: bestResult!, tested }
}
