import type { KLine, FactorScore, SignalThresholds } from '../../types'
import { etfFactors } from '../../factors/etf'
import { DEFAULT_SIGNAL_THRESHOLDS } from '../../config/defaults'

export interface ScoringResult {
  compositeScore: number
  signal: 'buy' | 'hold' | 'sell'
  factorScores: FactorScore[]
  weights: Record<string, number>
}

export function scoreETF(
  bars: KLine[],
  weights: Record<string, number>,
  thresholds: SignalThresholds = DEFAULT_SIGNAL_THRESHOLDS
): ScoringResult {
  const factorScores: FactorScore[] = etfFactors.map(factor => ({
    factorId: factor.id,
    name: factor.name,
    score: factor.calculate(bars),
  }))

  let compositeScore = 0
  for (const fs of factorScores) {
    const w = weights[fs.factorId] ?? 0.25
    compositeScore += fs.score * w
  }
  compositeScore = Math.round(compositeScore)

  let signal: 'buy' | 'hold' | 'sell'
  if (compositeScore >= thresholds.buyThreshold) {
    signal = 'buy'
  } else if (compositeScore < thresholds.sellThreshold) {
    signal = 'sell'
  } else {
    signal = 'hold'
  }

  return { compositeScore, signal, factorScores, weights: { ...weights } }
}
