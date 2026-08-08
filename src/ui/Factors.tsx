import { useState, useEffect } from 'react'
import type { LearningLog } from '../types'
import { getWeights, getLearningLogs, getSetting, saveSetting, saveWeights, getETFList, getKLines } from '../data/db'
import { DEFAULT_ETF_WEIGHTS, DEFAULT_SIGNAL_THRESHOLDS } from '../config/defaults'
import { runDiagnostics, type FactorICResult } from '../engine/etf/diagnostics'
import { etfFactors } from '../factors/etf'
import './Factors.css'

function icColor(v: number): string {
  if (v > 0.1) return 'var(--green)'
  if (v < -0.05) return 'var(--red)'
  return 'var(--text-secondary)'
}

export default function Factors() {
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_ETF_WEIGHTS)
  const [logs, setLogs] = useState<LearningLog[]>([])
  const [buyThreshold, setBuyThreshold] = useState(DEFAULT_SIGNAL_THRESHOLDS.buyThreshold)
  const [sellThreshold, setSellThreshold] = useState(DEFAULT_SIGNAL_THRESHOLDS.sellThreshold)
  const [saved, setSaved] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagResults, setDiagResults] = useState<{ code: string; name: string; compositeIC: number; factors: FactorICResult[] }[]>([])

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

  // 因子有效性诊断：对每只自选ETF计算各因子IC（分数与未来5日收益的相关性）
  const handleDiagnose = async () => {
    setDiagnosing(true)
    try {
      const list = await getETFList()
      const w = await getWeights('etf') ?? DEFAULT_ETF_WEIGHTS
      const results: { code: string; name: string; compositeIC: number; factors: FactorICResult[] }[] = []
      for (const etf of list) {
        const bars = await getKLines(etf.code)
        if (bars.length < 70) continue
        const res = runDiagnostics(bars, etfFactors, w, 5)
        if (res.factors.length === 0) continue
        results.push({ code: etf.code, name: etf.name, compositeIC: res.compositeIC, factors: res.factors })
      }
      setDiagResults(results)
    } catch {
      setDiagResults([])
    } finally {
      setDiagnosing(false)
    }
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

  // 诊断结果汇总：各因子跨ETF的平均IC/命中率/样本
  const factorSummaries = ['trend', 'momentum', 'volatility', 'moneyFlow'].map(fid => {
    const list = diagResults.flatMap(r => r.factors.filter(f => f.factorId === fid))
    return {
      fid,
      name: factorNames[fid] ?? fid,
      avgIC: list.length > 0 ? list.reduce((s, f) => s + f.ic, 0) / list.length : 0,
      avgHit: list.length > 0 ? list.reduce((s, f) => s + f.hitRate, 0) / list.length : 0,
      samples: list.reduce((s, f) => s + f.sampleCount, 0),
    }
  })
  const avgCompositeIC = diagResults.length > 0
    ? diagResults.reduce((s, r) => s + r.compositeIC, 0) / diagResults.length
    : 0

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

      {/* 因子有效性诊断 */}
      <section className="factors-section">
        <h3>因子有效性诊断</h3>
        <button className="factor-save-btn" onClick={handleDiagnose} disabled={diagnosing}>
          {diagnosing ? '诊断中...' : '📊 运行诊断（全部ETF）'}
        </button>
        <p className="diag-note">
          IC = 因子分数与未来5日收益的相关系数。IC &gt; 0.1 有效、≈0 无预测力、负值反向有害。
        </p>
        {diagnosing && <p className="empty-log">正在计算，请稍候...</p>}
        {!diagnosing && diagResults.length === 0 && (
          <p className="empty-log">点"运行诊断"查看各因子在自选ETF上的有效性（需先刷新数据，每只≥70天）</p>
        )}
        {diagResults.length > 0 && (
          <>
            <table className="diag-table">
              <thead>
                <tr>
                  <th>因子</th><th>平均IC</th><th>命中率</th><th>样本</th>
                </tr>
              </thead>
              <tbody>
                {factorSummaries.map(s => (
                  <tr key={s.fid}>
                    <td>{s.name}</td>
                    <td style={{ color: icColor(s.avgIC), fontWeight: 700 }}>{s.avgIC.toFixed(3)}</td>
                    <td>{(s.avgHit * 100).toFixed(1)}%</td>
                    <td>{s.samples}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>综合分</td>
                  <td style={{ color: icColor(avgCompositeIC), fontWeight: 700 }}>{avgCompositeIC.toFixed(3)}</td>
                  <td colSpan={2} style={{ color: 'var(--text-secondary)' }}>对 {diagResults.length} 只ETF取平均</td>
                </tr>
              </tbody>
            </table>
            <div className="diag-per-etf">
              {diagResults.map(r => (
                <div key={r.code} className="diag-etf-row">
                  <span>{r.name}（{r.code}）</span>
                  <span style={{ color: icColor(r.compositeIC) }}>综合IC {r.compositeIC.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
