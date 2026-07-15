import type { Factor } from '../../types'
import { trendFactor } from './trend'
import { momentumFactor } from './momentum'
import { volatilityFactor } from './volatility'
import { moneyFlowFactor } from './moneyFlow'

export const etfFactors: Factor[] = [
  trendFactor,
  momentumFactor,
  volatilityFactor,
  moneyFlowFactor,
]

export function getFactorById(id: string): Factor | undefined {
  return etfFactors.find(f => f.id === id)
}
