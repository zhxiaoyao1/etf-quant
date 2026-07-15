import type { SignalThresholds, LearningConfig } from '../types'

export const DEFAULT_SIGNAL_THRESHOLDS: SignalThresholds = {
  buyThreshold: 80,
  sellThreshold: 40,
}

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  learningRate: 0.3,
  lookbackWindow: 20,
  minSamples: 10,
  weightMin: 0.10,
  weightMax: 0.50,
}

export const DEFAULT_ETF_WEIGHTS: Record<string, number> = {
  trend: 0.25,
  momentum: 0.25,
  volatility: 0.25,
  moneyFlow: 0.25,
}

export const FACTOR_PARAMS = {
  trend: {
    maFast: 5,
    maMid: 20,
    maSlow: 60,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
  },
  momentum: {
    rsiPeriod: 14,
    kdjPeriod: 9,
    kdjSignal: 3,
  },
  volatility: {
    bbPeriod: 20,
    bbStdDev: 2,
    atrPeriod: 14,
  },
  moneyFlow: {
    obvPeriod: 20,
    volChangePeriod: 5,
  },
} as const

export const DEFAULT_ETF_LIST = [
  { code: '510300', name: '沪深300ETF', market: 'SH' as const },
  { code: '510050', name: '上证50ETF', market: 'SH' as const },
  { code: '510500', name: '中证500ETF', market: 'SH' as const },
  { code: '159915', name: '创业板ETF', market: 'SZ' as const },
  { code: '588000', name: '科创50ETF', market: 'SH' as const },
  { code: '512480', name: '半导体ETF', market: 'SH' as const },
  { code: '516160', name: '新能源ETF', market: 'SH' as const },
  { code: '512880', name: '证券ETF', market: 'SH' as const },
  { code: '512010', name: '医药ETF', market: 'SH' as const },
  { code: '159869', name: '游戏ETF', market: 'SZ' as const },
]
