import { useState, useEffect } from 'react'
import type { ETFInfo, Signal } from '../types'
import { DEFAULT_ETF_LIST } from '../config/defaults'
import { useETFWorker } from '../hooks/useWorker'
import { getETFList, saveETFList, getSignals } from '../data/db'
import './Dashboard.css'

export default function Dashboard({ mobile }: { mobile?: boolean }) {
  const [etfs, setEtfs] = useState<ETFInfo[]>([])
  const [signals, setSignals] = useState<Map<string, Signal>>(new Map())
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
    // 手机端自动刷新数据
    if (mobile) {
      getETFList().then(list => {
        const etfData = list.length > 0 ? list : DEFAULT_ETF_LIST
        fetchAndStore(etfData).then(() => analyze(etfData).then(newSignals => {
          const map = new Map<string, Signal>()
          for (const s of newSignals) map.set(s.etfCode, s)
          setSignals(map)
        }))
      })
    }
  }, [])

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
      <div className={`dashboard-header${mobile ? ' mobile-header' : ''}`}>
        <h2>{mobile ? 'ETF 量化信号' : '📊 看板'}</h2>
        <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
          {loading ? '更新中...' : '🔄 刷新'}
        </button>
      </div>

      {etfs.length === 0 && (
        <div className="empty-state">
          <p>{'暂无 ETF 关注列表'}</p>
          {!mobile && <p className="sub">{'请在设置中添加'}</p>}
        </div>
      )}

      <div className="etf-list">
        {etfs.map(etf => {
          const sig = signals.get(etf.code)
          return (
            <div key={etf.code} className="etf-card">
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
    </div>
  )
}
