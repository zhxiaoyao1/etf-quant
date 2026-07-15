import type { KLine, SignalThresholds } from '../../types'
import { scoreETF } from './scorer'
import { DEFAULT_SIGNAL_THRESHOLDS } from '../../config/defaults'

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
}

/**
 * Run backtest on historical K-line data
 * @param bars K-line data (must be sorted by date ascending)
 * @param weights Factor weights to use
 * @param thresholds Signal thresholds (default: buy>=80, sell<40)
 * @param initialCapital Starting capital (default: 100000)
 */
export function runBacktest(
  bars: KLine[],
  weights: Record<string, number>,
  thresholds: SignalThresholds = DEFAULT_SIGNAL_THRESHOLDS,
  initialCapital: number = 100000
): BacktestResult {
  if (bars.length < 80) {
    return {
      totalReturn: 0, annualizedReturn: 0, maxDrawdown: 0,
      sharpeRatio: 0, winRate: 0, totalTrades: 0, winningTrades: 0,
      equityCurve: [], trades: [], buyAndHoldReturn: 0,
    }
  }

  let cash = initialCapital
  let shares = 0
  let holding = false
  let buyPrice = 0
  let buyDate = ''
  const trades: BacktestTrade[] = []
  const equityCurve: { date: string; value: number }[] = []
  const TREND_WINDOW = 8  // 趋势判断窗口
  const startIdx = 61
  const scoreHistory: number[] = []
  let prevScore = 50

  // 初始化前60天的分数
  if (bars.length > 60) {
    const initResult = scoreETF(bars.slice(0, 60), weights, thresholds)
    prevScore = initResult.compositeScore
    scoreHistory.push(initResult.compositeScore)
  }

  for (let i = startIdx; i < bars.length - 1; i++) {
    const windowBars = bars.slice(0, i + 1)
    const result = scoreETF(windowBars, weights, thresholds)
    const currentScore = result.compositeScore
    const currentPrice = bars[i].close
    scoreHistory.push(currentScore)

    // 计算分数趋势：最近 TREND_WINDOW 天是涨还是跌
    const trendScores = scoreHistory.slice(-TREND_WINDOW)
    const trendSlope = trendScores.length >= 5
      ? trendScores[trendScores.length - 1] - trendScores[0]
      : 0
    const scoreTrending = trendSlope > 2   // 上升趋势
    const scoreFalling = trendSlope < -2    // 下降趋势

    // 买入：分数穿越买入线 + 趋势向上（分数在涨，不是假突破）
    const crossedBuy = prevScore < thresholds.buyThreshold && currentScore >= thresholds.buyThreshold
    const validBuy = crossedBuy && scoreTrending

    // 卖出：分数穿越卖出线 + 趋势向下（分数在跌，不是假跌破）
    const crossedSell = prevScore > thresholds.sellThreshold && currentScore <= thresholds.sellThreshold
    const validSell = crossedSell && scoreFalling

    if (!holding && validBuy) {
      const nextOpen = bars[i + 1].open
      shares = cash / nextOpen
      cash = 0
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

  for (let buy = 55; buy <= 85; buy += 5) {
    for (let sell = 25; sell <= 45; sell += 5) {
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
        const result = runBacktest(bars, weights, { buyThreshold: buy, sellThreshold: sell })
        if (result.totalTrades > maxTrades) {
          maxTrades = result.totalTrades
          bestBuy = buy
          bestSell = sell
          bestResult = result
        }
      }
      tested++
    }
  }

  return { bestBuy, bestSell, bestResult: bestResult!, tested }
}
