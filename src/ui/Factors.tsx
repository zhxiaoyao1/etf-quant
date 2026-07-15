import { useState, useEffect } from 'react'
import type { LearningLog } from '../types'
import { getWeights, getLearningLogs } from '../data/db'
import { DEFAULT_ETF_WEIGHTS } from '../config/defaults'
import './Factors.css'

export default function Factors() {
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_ETF_WEIGHTS)
  const [logs, setLogs] = useState<LearningLog[]>([])

  useEffect(() => {
    getWeights('etf').then(w => { if (w) setWeights(w) })
    getLearningLogs('etf', 20).then(setLogs)
  }, [])

  const factorNames: Record<string, string> = {
    trend: '趋势', momentum: '动量', volatility: '波动率', moneyFlow: '资金流',
  }

  return (
    <div className="factors">
      <h2>🧠 因子仪表盘</h2>
      <section className="factors-section">
        <h3>当前权重分配</h3>
        <div className="weight-bars">
          {Object.entries(weights).map(([id, w]) => (
            <div key={id} className="weight-bar-row">
              <span className="weight-label">{factorNames[id] ?? id}</span>
              <div className="weight-bar-track">
                <div className="weight-bar-fill" style={{ width: `${w * 100}%` }} />
              </div>
              <span className="weight-pct">{(w * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>
      <section className="factors-section">
        <h3>权重调整日志</h3>
        {logs.length === 0 && <p className="empty-log">暂无调整记录，积累足够信号后系统会自动学习</p>}
        <div className="log-list">
          {logs.map(log => (
            <div key={log.id} className="log-item">
              <div className="log-date">{log.date}</div>
              <div className="log-changes">
                {Object.entries(log.newWeights).map(([id, newW]) => {
                  const oldW = log.oldWeights[id] ?? newW
                  const diff = newW - oldW
                  const arrow = diff > 0.01 ? '↑' : diff < -0.01 ? '↓' : '→'
                  const color = diff > 0.01 ? 'var(--green)' : diff < -0.01 ? 'var(--red)' : 'var(--text-secondary)'
                  return (
                    <div key={id} className="log-change" style={{ color }}>
                      {factorNames[id] ?? id}: {(oldW * 100).toFixed(0)}% → {(newW * 100).toFixed(0)}% {arrow}
                    </div>
                  )
                })}
              </div>
              <div className="log-meta">基于 {log.sampleCount} 条信号</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
