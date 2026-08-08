import type { KLine } from '../../types'
import { sma, atr } from '../common'
import { MA_PERIOD, ATR_PERIOD } from './trendSignal'

/** ATR 移动止损倍数：持仓最高价回撤超过 N×ATR 即离场 */
export const ATR_STOP_MULT = 2.5

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
 * 纯趋势跟随回测：
 * - 买入：收盘价上穿 MA20 且 MA20 向上 → 次日开盘满仓
 * - 卖出：收盘价跌破 MA20（趋势破位）或跌破 ATR 移动止损 → 次日开盘清仓
 * @param bars K线数据（按日期升序）
 * @param maPeriod 均线周期（默认 20）
 * @param stopMult ATR 止损倍数（默认 2.5）
 * @param initialCapital 初始资金（默认 10万）
 */
export function runBacktest(
  bars: KLine[],
  maPeriod: number = MA_PERIOD,
  stopMult: number = ATR_STOP_MULT,
  initialCapital: number = 100000
): BacktestResult {
  if (bars.length < maPeriod + 2) {
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
  let peakHigh = 0
  const trades: BacktestTrade[] = []
  const equityCurve: { date: string; value: number }[] = []
  const closes = bars.map(b => b.close)

  for (let i = maPeriod; i < bars.length - 1; i++) {
    const maNow = sma(closes.slice(0, i + 1), maPeriod)
    const maPrev = sma(closes.slice(0, i), maPeriod)
    const prevClose = closes[i - 1]
    const close = closes[i]

    // 穿越：昨收在 MA 一侧、今收在另一侧
    const crossUp = prevClose <= maPrev && close > maNow
    const crossDown = prevClose >= maPrev && close < maNow
    const maRising = maNow > maPrev

    // ATR 移动止损：持仓最高价回撤超过 N×ATR → 离场
    let stopHit = false
    if (holding) {
      if (bars[i].high > peakHigh) peakHigh = bars[i].high
      const a = atr(bars.slice(0, i + 1), ATR_PERIOD)
      if (a > 0 && close < peakHigh - stopMult * a) stopHit = true
    }

    if (!holding && crossUp && maRising) {
      const nextOpen = bars[i + 1].open
      shares = cash / nextOpen
      cash = 0
      holding = true
      buyPrice = nextOpen
      buyDate = bars[i + 1].date
      peakHigh = nextOpen
    }
    else if (holding && (crossDown || stopHit)) {
      const nextOpen = bars[i + 1].open
      cash = shares * nextOpen
      const tradeReturn = (nextOpen - buyPrice) / buyPrice
      const holdDays = Math.round(
        (new Date(bars[i + 1].date).getTime() - new Date(buyDate).getTime()) / 86400000
      )
      trades.push({ buyDate, buyPrice, sellDate: bars[i + 1].date, sellPrice: nextOpen, return: tradeReturn, holdDays })
      shares = 0
      holding = false
    }

    equityCurve.push({ date: bars[i].date, value: cash + shares * close })
  }

  // 若仍持仓，按最后收盘价平仓
  if (holding && shares > 0) {
    const lastPrice = bars[bars.length - 1].close
    cash = shares * lastPrice
    const tradeReturn = (lastPrice - buyPrice) / buyPrice
    const holdDays = Math.round(
      (new Date(bars[bars.length - 1].date).getTime() - new Date(buyDate).getTime()) / 86400000
    )
    trades.push({ buyDate, buyPrice, sellDate: bars[bars.length - 1].date, sellPrice: lastPrice, return: tradeReturn, holdDays })
    equityCurve.push({ date: bars[bars.length - 1].date, value: cash })
  }

  // 指标计算
  const finalValue = cash + shares * bars[bars.length - 1].close
  const totalReturn = (finalValue - initialCapital) / initialCapital
  const tradingDays = bars.length - maPeriod
  const years = tradingDays / 252
  const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0

  let maxDrawdown = 0
  let peakValue = initialCapital
  for (const point of equityCurve) {
    if (point.value > peakValue) peakValue = point.value
    const drawdown = (point.value - peakValue) / peakValue
    if (drawdown < maxDrawdown) maxDrawdown = drawdown
  }

  const dailyReturns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push((equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value)
  }
  const avgDailyReturn = dailyReturns.reduce((s, r) => s + r, 0) / (dailyReturns.length || 1)
  const stdDailyReturn = Math.sqrt(
    dailyReturns.reduce((s, r) => s + (r - avgDailyReturn) ** 2, 0) / (dailyReturns.length || 1)
  )
  const sharpeRatio = stdDailyReturn > 0 ? (avgDailyReturn / stdDailyReturn) * Math.sqrt(252) : 0

  const winningTrades = trades.filter(t => (t.return ?? 0) > 0).length
  const winRate = trades.length > 0 ? winningTrades / trades.length : 0
  const firstPrice = closes[maPeriod]
  const lastPrice = closes[bars.length - 1]
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
