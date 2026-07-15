import { useState, useEffect } from 'react'
import type { ETFInfo, Signal } from '../types'
import { DEFAULT_ETF_LIST } from '../config/defaults'
import { useETFWorker } from '../hooks/useWorker'
import { getETFList, saveETFList, getSignals } from '../data/db'
import './Dashboard.css'

export default function Dashboard() {
  const [etfs, setEtfs] = useState<ETFInfo[]>([])
  const [signals, setSignals] = useState<Map<string, Signal>>(new Map())
  const [modalETF, setModalETF] = useState<ETFInfo | null>(null)
  const [recentScores, setRecentScores] = useState<Signal[]>([])
  const { fetchAndStore, analyze, loading } = useETFWorker()

  useEffect(() => {
    getETFList().then(list => {
      if (list.length === 0) {
        saveETFList(DEFAULT_ETF_LIST)
        setEtfs(DEFAULT_ETF_LIST)
      } else {
        setEtfs(list)
      }
    })
    getSignals({ limit: 50 }).then(existing => {
      const map = new Map<string, Signal>()
      for (const s of existing) {
        const prev = map.get(s.etfCode)
        if (!prev || s.date > prev.date) {
          map.set(s.etfCode, s)
        }
      }
      setSignals(map)
    })
  }, [])

  const handleCardClick = async (etf: ETFInfo) => {
    setModalETF(etf)
    const sigs = await getSignals({ etfCode: etf.code, limit: 10 })
    setRecentScores(sigs)
  }

  const handleRefresh = async () => {
    if (etfs.length === 0) return
    await fetchAndStore(etfs)
    const newSignals = await analyze(etfs)
    const map = new Map(signals)
    for (const s of newSignals) {
      map.set(s.etfCode, s)
    }
    setSignals(new Map(map))
  }

  const signalEmoji = (s: string) => s === 'buy' ? '🟢' : s === 'sell' ? '🔴' : '🟡'
  const signalLabel = (s: string) => s === 'buy' ? '买入' : s === 'sell' ? '卖出' : '观望'
  const scoreColor = (s: string) =>
    s === 'buy' ? 'var(--green)' : s === 'sell' ? 'var(--red)' : 'var(--yellow)'

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>{'📊'} {'看板'}</h2>
        <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
          {loading ? '更新中...' : '🔄 刷新'}
        </button>
      </div>

      {etfs.length === 0 && (
        <div className="empty-state">
          <p>{'暂无 ETF 关注列表'}</p>
          <p className="sub">{'请在设置中添加'}</p>
        </div>
      )}

      <div className="etf-list">
        {etfs.map(etf => {
          const sig = signals.get(etf.code)
          return (
            <div key={etf.code} className="etf-card" onClick={() => handleCardClick(etf)}>
              <div className="etf-info">
                <div className="etf-name">{etf.name}</div>
                <div className="etf-code">{etf.code}.{etf.market}</div>
              </div>
              <div className="etf-signal">
                <span className="signal-emoji">{sig ? signalEmoji(sig.signal) : '⚪'}</span>
                <div className="signal-label">{sig ? signalLabel(sig.signal) : '待分析'}</div>
              </div>
              <div className="etf-score">
                {sig ? (
                  <span style={{ color: scoreColor(sig.signal), fontWeight: 700, fontSize: 22 }}>
                    {sig.compositeScore}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>--</span>
                )}
                <div className="score-label">{'综合评分'}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 近十日分数弹窗 */}
      {modalETF && (
        <div className="score-modal-overlay" onClick={() => setModalETF(null)}>
          <div className="score-modal" onClick={e => e.stopPropagation()}>
            <div className="score-modal-header">
              <h3>{modalETF.name}</h3>
              <span className="score-modal-code">{modalETF.code}.{modalETF.market}</span>
              <button className="score-modal-close" onClick={() => setModalETF(null)}>✕</button>
            </div>
            <div className="score-list">
              {recentScores.length === 0 ? (
                <p className="score-empty">暂无评分记录，请先点刷新</p>
              ) : (
                recentScores.map((s, i) => (
                  <div key={s.id} className="score-row">
                    <span className="score-date">{s.date}</span>
                    <span className="score-trend">
                      {i < recentScores.length - 1 && (
                        s.compositeScore > recentScores[i + 1].compositeScore ? '↑' :
                        s.compositeScore < recentScores[i + 1].compositeScore ? '↓' : '→'
                      )}
                    </span>
                    <span className="score-emoji">{signalEmoji(s.signal)}</span>
                    <span className="score-num" style={{ color: scoreColor(s.signal) }}>{s.compositeScore}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
