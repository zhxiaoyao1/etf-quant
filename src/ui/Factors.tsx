import { useState, useEffect } from 'react'
import type { LearningLog } from '../types'
import { getWeights, getLearningLogs, getSetting, saveSetting, saveWeights } from '../data/db'
import { DEFAULT_ETF_WEIGHTS, DEFAULT_SIGNAL_THRESHOLDS } from '../config/defaults'
import './Factors.css'

export default function Factors() {
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_ETF_WEIGHTS)
  const [logs, setLogs] = useState<LearningLog[]>([])
  const [buyThreshold, setBuyThreshold] = useState(DEFAULT_SIGNAL_THRESHOLDS.buyThreshold)
  const [sellThreshold, setSellThreshold] = useState(DEFAULT_SIGNAL_THRESHOLDS.sellThreshold)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getWeights('etf').then(w => { if (w) setWeights(w) })
    getLearningLogs('etf', 20).then(setLogs)
    getSetting<number>('buyThreshold').then(v => { if (v) setBuyThreshold(v) })
    getSetting<number>('sellThreshold').then(v => { if (v) setSellThreshold(v) })
  }, [])

  const handleSave = async () => {
    await saveWeights('etf', weights)
    await saveSetting('buyThreshold', buyThreshold)
    await saveSetting('sellThreshold', sellThreshold)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateWeight = (id: string, value: number) => {
    setWeights(prev => ({ ...prev, [id]: value / 100 }))
  }

  const factorNames: Record<string, string> = {
    trend: '趋势', momentum: '动量', volatility: '波动率', moneyFlow: '资金流',
  }

  const factorPct: Record<string, number> = {}
  for (const [id, w] of Object.entries(weights)) {
    factorPct[id] = Math.round(w * 100)
  }

  return (
    <div className="factors">
      <h2>🧠 因子仪表盘</h2>

      {/* 权重调节 */}
      <section className="factors-section">
        <h3>因子权重</h3>
        {Object.entries(weights).map(([id]) => (
          <div key={id} className="factor-slider-row">
            <label className="factor-slider-label">{factorNames[id] ?? id}</label>
            <input type="range" min={5} max={50} step={5} value={factorPct[id]} onChange={e => updateWeight(id, Number(e.target.value))} />
            <span className="factor-slider-val">{factorPct[id]}%</span>
          </div>
        ))}
      </section>

      {/* 阈值调节 */}
      <section className="factors-section">
        <h3>买卖阈值</h3>
        <div className="factor-slider-row">
          <label className="factor-slider-label">买入阈值</label>
          <input type="range" min={30} max={95} value={buyThreshold} onChange={e => setBuyThreshold(Number(e.target.value))} />
          <span className="factor-slider-val" style={{color:'var(--green)'}}>{buyThreshold}</span>
        </div>
        <div className="factor-slider-row">
          <label className="factor-slider-label">卖出阈值</label>
          <input type="range" min={10} max={60} value={sellThreshold} onChange={e => setSellThreshold(Number(e.target.value))} />
          <span className="factor-slider-val" style={{color:'var(--red)'}}>{sellThreshold}</span>
        </div>
      </section>

      <button className="factor-save-btn" onClick={handleSave}>
        {saved ? '✅ 已保存' : '💾 保存权重和阈值'}
      </button>

      {/* 学习日志 */}
      <section className="factors-section">
        <h3>权重调整日志</h3>
        {logs.length === 0 && <p className="empty-log">暂无调整记录</p>}
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
