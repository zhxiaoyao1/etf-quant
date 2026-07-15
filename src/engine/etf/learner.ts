import type { Signal, LearningConfig } from '../../types'
import { DEFAULT_LEARNING_CONFIG } from '../../config/defaults'

export interface AdjustmentResult {
  newWeights: Record<string, number>
  factorAccuracies: Record<string, number>
  sampleCount: number
}

export function adjustWeights(
  signals: Signal[],
  actualOutcome: 'up' | 'down',
  oldWeights: Record<string, number>,
  config: LearningConfig = DEFAULT_LEARNING_CONFIG
): AdjustmentResult {
  if (signals.length < config.minSamples) {
    return {
      newWeights: { ...oldWeights },
      factorAccuracies: {},
      sampleCount: signals.length,
    }
  }

  const factorIds = Object.keys(oldWeights)
  if (factorIds.length === 0) {
    return { newWeights: { ...oldWeights }, factorAccuracies: {}, sampleCount: signals.length }
  }

  const correctCount: Record<string, number> = {}
  const totalCount: Record<string, number> = {}
  for (const id of factorIds) {
    correctCount[id] = 0
    totalCount[id] = 0
  }

  for (const signal of signals.slice(-config.lookbackWindow)) {
    for (const fs of signal.factorScores) {
      totalCount[fs.factorId] = (totalCount[fs.factorId] ?? 0) + 1
      const predictedUp = fs.score > 50
      const actualUp = actualOutcome === 'up'
      if (predictedUp === actualUp) {
        correctCount[fs.factorId] = (correctCount[fs.factorId] ?? 0) + 1
      }
    }
  }

  const accuracies: Record<string, number> = {}
  for (const id of factorIds) {
    accuracies[id] = totalCount[id] > 0
      ? correctCount[id] / totalCount[id]
      : 0.5
  }

  const totalAccuracy = Object.values(accuracies).reduce((s, a) => s + a, 0)
  const rawNewWeights: Record<string, number> = {}
  for (const id of factorIds) {
    rawNewWeights[id] = totalAccuracy > 0
      ? accuracies[id] / totalAccuracy
      : 1 / factorIds.length
  }

  const alpha = config.learningRate
  const merged: Record<string, number> = {}
  for (const id of factorIds) {
    merged[id] = oldWeights[id] * (1 - alpha) + rawNewWeights[id] * alpha
  }

  const clamped: Record<string, number> = {}
  for (const id of factorIds) {
    clamped[id] = Math.max(config.weightMin, Math.min(config.weightMax, merged[id]))
  }

  const clampedSum = Object.values(clamped).reduce((s, w) => s + w, 0)
  const normalized: Record<string, number> = {}
  for (const id of factorIds) {
    normalized[id] = clampedSum > 0
      ? parseFloat((clamped[id] / clampedSum).toFixed(4))
      : 1 / factorIds.length
  }

  return { newWeights: normalized, factorAccuracies: accuracies, sampleCount: signals.length }
}
