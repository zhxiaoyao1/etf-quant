// src/types/index.ts

/** 日K线数据 */
export interface KLine {
  date: string // '2026-07-15'
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** ETF 基本信息 */
export interface ETFInfo {
  code: string // '510300'
  name: string // '沪深300ETF'
  market: 'SH' | 'SZ' // 上海 or 深圳
}

/** 因子评分（单个因子输出） */
export interface FactorScore {
  factorId: string
  name: string
  score: number // 0-100
}

/** 综合信号 */
export interface Signal {
  id: string
  etfCode: string
  date: string
  compositeScore: number // 0-100
  signal: 'buy' | 'hold' | 'sell' // 🟢🟡🔴
  factorScores: FactorScore[]
  weights: Record<string, number> // 生成信号时的权重快照
}

/** 自学习权重调整日志 */
export interface LearningLog {
  id: string
  date: string
  engine: 'etf' | 'mutual-fund-screening' | 'mutual-fund-diagnosis'
  oldWeights: Record<string, number>
  newWeights: Record<string, number>
  factorAccuracies: Record<string, number> // 各因子近期准确率
  sampleCount: number // 参与评估的信号数
}

/** 因子接口（所有因子模块需实现） */
export interface Factor {
  id: string
  name: string
  description: string
  calculate(bars: KLine[]): number // 输出 0-100
  params: Record<string, number> // 可配置参数
}

/** IndexedDB schema */
export interface DBStore {
  etfList: ETFInfo[]
  klineData: { etfCode: string; bars: KLine[] }[]
  signals: Signal[]
  learningLogs: LearningLog[]
  weights: { engine: string; weights: Record<string, number>; updatedAt: string }[]
  settings: { key: string; value: unknown }[]
}

/** 信号阈值配置 */
export interface SignalThresholds {
  buyThreshold: number // 默认 80
  sellThreshold: number // 默认 40
}

/** 自学习配置 */
export interface LearningConfig {
  learningRate: number // 默认 0.3
  lookbackWindow: number // 默认 20
  minSamples: number // 默认 10
  weightMin: number // 默认 0.10
  weightMax: number // 默认 0.50
}
