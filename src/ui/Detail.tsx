import { useState, useEffect } from 'react'
import type { ETFInfo, KLine, Signal } from '../types'
import { DEFAULT_ETF_LIST } from '../config/defaults'
import { getETFList, getKLines, getSignals } from '../data/db'
import { useETFWorker } from '../hooks/useWorker'
import './Detail.css'

export default function Detail() {
  const [etfs, setEtfs] = useState<ETFInfo[]>(DEFAULT_ETF_LIST)
  const [selectedETF, setSelectedETF] = useState<ETFInfo>(etfs[0])
  const [bars, setBars] = useState<KLine[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const { analyze, loading } = useETFWorker()

  useEffect(() => {
    getETFList().then(list => {
      if (list.length > 0) { setEtfs(list); setSelectedETF(list[0]) }
    })
  }, [])

  useEffect(() => {
    if (!selectedETF) return
    getKLines(selectedETF.code).then(setBars)
    getSignals({ etfCode: selectedETF.code, limit: 20 }).then(setSignals)
  }, [selectedETF])

  const handleAnalyze = async () => {
    if (!selectedETF) return
    const newSignals = await analyze([selectedETF])
    if (newSignals.length > 0) {
      setSignals(prev => [newSignals[0], ...prev].slice(0, 20))
    }
  }

  const latestSignal = signals[0]
  const signalEmoji = (s: string) => s === 'buy' ? '\u{1F7E2}' : s === 'sell' ? '\u{1F534}' : '\u{1F7E1}'

  return (
    <div className="detail">
      <select className="etf-selector" value={selectedETF?.code ?? ''} onChange={e => {
        const etf = etfs.find(x => x.code === e.target.value)
        if (etf) setSelectedETF(etf)
      }}>
        {etfs.map(etf => (
          <option key={etf.code} value={etf.code}>{etf.name} ({etf.code})</option>
        ))}
      </select>

      {latestSignal && (
        <div className={`signal-banner signal-${latestSignal.signal}`}>
          <span className="signal-emoji-large">{signalEmoji(latestSignal.signal)}</span>
          <div>
            <div className="signal-text">{latestSignal.signal === 'buy' ? '买入' : latestSignal.signal === 'sell' ? '卖出' : '观望'}</div>
            <div className="signal-date">{latestSignal.date}</div>
          </div>
          <div className="signal-score-det">{latestSignal.compositeScore}</div>
        </div>
      )}

      {latestSignal && (
        <div className="factor-grid">
          {latestSignal.factorScores.map(fs => (
            <div key={fs.factorId} className="factor-item">
              <div className="factor-name">{fs.name}</div>
              <div className="factor-value" style={{
                color: fs.score >= 70 ? 'var(--green)' : fs.score < 40 ? 'var(--red)' : 'var(--yellow)'
              }}>{fs.score}</div>
            </div>
          ))}
        </div>
      )}

      <div className="chart-placeholder">
        <p>{'\u{1F4C8}'} K线图区域</p>
        <p className="sub">数据点数: {bars.length}</p>
      </div>

      <h3 style={{ marginTop: 16, marginBottom: 8 }}>信号历史</h3>
      <div className="signal-history">
        {signals.slice(0, 10).map(sig => (
          <div key={sig.id} className="history-item">
            <span>{sig.date}</span>
            <span>{signalEmoji(sig.signal)}</span>
            <span style={{ color: sig.signal === 'buy' ? 'var(--green)' : sig.signal === 'sell' ? 'var(--red)' : 'var(--yellow)' }}>{sig.compositeScore}</span>
          </div>
        ))}
        {signals.length === 0 && <div className="history-item"><span style={{color: 'var(--text-secondary)'}}>暂无信号记录</span></div>}
      </div>

      <button className="analyze-btn" onClick={handleAnalyze} disabled={loading}>
        {loading ? '分析中...' : '\u{1F50D} 分析此ETF'}
      </button>
    </div>
  )
}
