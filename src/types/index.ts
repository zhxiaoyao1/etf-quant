// src/types/index.ts

/** 日K线数据 */
export interface KLine {
  date: string // '2026-07-15'
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount?: number    // 成交额（元）
  turnover?: number  // 换手率（%）
}

/** ETF 基本信息 */
export interface ETFInfo {
  code: string // '510300'
  name: string // '沪深300ETF'
  market: 'SH' | 'SZ' // 上海 or 深圳
}

/** 趋势信号 */
export interface Signal {
  id: string
  etfCode: string
  date: string
  score: number // 趋势分 0-100，50=收盘价正好在 MA20 上
  signal: 'buy' | 'hold' | 'sell' // 🟢🟡🔴
}

/** IndexedDB schema */
export interface DBStore {
  etfList: ETFInfo[]
  klineData: { etfCode: string; bars: KLine[] }[]
  signals: Signal[]
  settings: { key: string; value: unknown }[]
}

/** 场外基金净值数据 */
export interface FundNAV {
  date: string
  nav: number
  accumulatedNav: number
  dailyReturn: number
}
