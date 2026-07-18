import type { KLine, LearningConfig } from '../../types'
import { scoreETF } from './scorer'
import { DEFAULT_LEARNING_CONFIG } from '../../config/defaults'

export interface AdjustmentResult {
  newWeights: Record<string, number>
  factorAccuracies: Record<string, number>
  sampleCount: number
}

/**
 * 从历史 K 线数据学习：对每个交易日打分，N天后验证涨跌，统计各因子准确率
 *
 * @param bars K线数据
 * @param oldWeights 当前权重
 * @param config 学习参数（回看窗口、学习率等）
 * @param verifyDays 验证天数（默认5天）
 */
export function learnFromHistory(
  bars: KLine[],
  oldWeights: Record<string, number>,
  config: LearningConfig = DEFAULT_LEARNING_CONFIG,
  verifyDays: number = 5
): AdjustmentResult {
  if (bars.length < 70) {
    return { newWeights: { ...oldWeights }, factorAccuracies: {}, sampleCount: 0 }
  }

  const factorIds = Object.keys(oldWeights)
  if (factorIds.length === 0) {
    return { newWeights: { ...oldWeights }, factorAccuracies: {}, sampleCount: 0 }
  }

  // 对每个可验证的交易日打分
  const correctCount: Record<string, number> = {}
  for (const id of factorIds) correctCount[id] = 0
  let sampleCount = 0

  const maxIdx = bars.length - 1 - verifyDays
  const windowSize = config.lookbackWindow
  // 取最近 windowSize 个可验证的交易日
  const startIdx = Math.max(60, maxIdx - windowSize)

  for (let i = startIdx; i <= maxIdx; i++) {
    const result = scoreETF(bars.slice(0, i + 1), oldWeights)
    // N 天后实际涨跌
    const futurePrice = bars[i + verifyDays].close
    const currentPrice = bars[i].close
    const actualUp = futurePrice > currentPrice

    for (const fs of result.factorScores) {
      const predictedUp = fs.score > 50
      if (predictedUp === actualUp) {
        correctCount[fs.factorId] = (correctCount[fs.factorId] ?? 0) + 1
      }
    }
    sampleCount++
  }

  if (sampleCount < config.minSamples) {
    return { newWeights: { ...oldWeights }, factorAccuracies: {}, sampleCount }
  }

  // 计算准确率
  const accuracies: Record<string, number> = {}
  for (const id of factorIds) {
    accuracies[id] = (correctCount[id] ?? 0) / sampleCount
  }

  // 按准确率分配新权重
  const totalAccuracy = Object.values(accuracies).reduce((s, a) => s + a, 0)
  const rawNewWeights: Record<string, number> = {}
  for (const id of factorIds) {
    rawNewWeights[id] = totalAccuracy > 0 ? accuracies[id] / totalAccuracy : 1 / factorIds.length
  }

  // 平滑合并
  const alpha = config.learningRate
  const merged: Record<string, number> = {}
  for (const id of factorIds) {
    merged[id] = oldWeights[id] * (1 - alpha) + rawNewWeights[id] * alpha
  }

  // 边界裁剪 + 归一化
  const clamped: Record<string, number> = {}
  for (const id of factorIds) {
    clamped[id] = Math.max(config.weightMin, Math.min(config.weightMax, merged[id]))
  }
  const clampedSum = Object.values(clamped).reduce((s, w) => s + w, 0)
  const normalized: Record<string, number> = {}
  for (const id of factorIds) {
    normalized[id] = clampedSum > 0 ? parseFloat((clamped[id] / clampedSum).toFixed(4)) : 1 / factorIds.length
  }

  return { newWeights: normalized, factorAccuracies: accuracies, sampleCount }
}

// 保留旧函数兼容
export function adjustWeights(
  _signals: any[],
  _actualOutcome: string,
  oldWeights: Record<string, number>,
  _config: LearningConfig = DEFAULT_LEARNING_CONFIG
): AdjustmentResult {
  return { newWeights: { ...oldWeights }, factorAccuracies: {}, sampleCount: 0 }
}
