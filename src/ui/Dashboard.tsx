import { useState, useEffect } from 'react'
import type { ETFInfo, Signal, KLine } from '../types'
import { DEFAULT_ETF_LIST } from '../config/defaults'
import { useETFWorker } from '../hooks/useWorker'
import { getETFList, saveETFList, getSignals, getKLines } from '../data/db'
import { computeTrendSignal } from '../engine/etf/trendSignal'
import { runPoolDiagnostics, type PoolFactorIC } from '../engine/etf/poolDiagnostics'
import { runPortfolioBacktest, runRankingPortfolioBacktest, type PortfolioBacktestResult } from '../engine/etf/portfolioBacktest'
import { signalEmoji, signalLabel, signalColor } from './signalHelpers'
import './Dashboard.css'

interface ScorePoint { date: string; score: number; signal: string }

function icColor(v: number): string {
  if (v > 0.1) return 'var(--green)'
  if (v < -0.05) return 'var(--red)'
  return 'var(--text-secondary)'
}

const factorLabel: Record<string, string> = {
  trend: '趋势', momentum: '动量', volatility: '波动率', moneyFlow: '资金流', total: '综合',
}

export default function Dashboard() {
  const [etfs, setEtfs] = useState<ETFInfo[]>([])
  const [signals, setSignals] = useState<Map<string, Signal>>(new Map())
  const [modalETF, setModalETF] = useState<ETFInfo | null>(null)
  const [recentScores, setRecentScores] = useState<ScorePoint[]>([])
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagByHorizon, setDiagByHorizon] = useState<{ forwardDays: number; factors: PoolFactorIC[] }[] | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioBacktestResult | null>(null)
  const [rankingPortfolio, setRankingPortfolio] = useState<PortfolioBacktestResult | null>(null)
  const { refresh, loading } = useETFWorker()

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
    // 从K线实时计算近十日趋势分
    const bars = await getKLines(etf.code)
    if (bars.length < 20) {
      setRecentScores([])
      return
    }
    const points: ScorePoint[] = []
    for (let i = bars.length - 1; i >= Math.max(19, bars.length - 10); i--) {
      const t = computeTrendSignal(bars.slice(0, i + 1))
      points.push({ date: bars[i].date, score: t.score, signal: t.signal })
    }
    setRecentScores(points)
  }

  const handleRefresh = async () => {
    if (etfs.length === 0) return
    const newSignals = await refresh(etfs)
    const map = new Map(signals)
    for (const s of newSignals) {
      map.set(s.etfCode, s)
    }
    setSignals(new Map(map))
  }

  // 池级策略诊断：多周期IC（5/20/60日）+ 组合回测
  const handlePoolDiagnose = async () => {
    setDiagnosing(true)
    try {
      const list = etfs.length > 0 ? etfs : await getETFList()
      const barsByCode = new Map<string, KLine[]>()
      for (const etf of list) {
        const bars = await getKLines(etf.code)
        if (bars.length >= 121) barsByCode.set(etf.code, bars)
      }
      if (barsByCode.size < 2) return
      const results = [5, 20, 60].map(h => ({
        forwardDays: h,
        factors: runPoolDiagnostics(barsByCode, h).factors,
      }))
      setDiagByHorizon(results)
      setPortfolio(runPortfolioBacktest(barsByCode))
      setRankingPortfolio(runRankingPortfolioBacktest(barsByCode))
    } finally {
      setDiagnosing(false)
    }
  }

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
                  <span style={{ color: signalColor(sig.signal), fontWeight: 700, fontSize: 22 }}>
                    {sig.score}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>--</span>
                )}
                <div className="score-label">{'总分'}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 池级策略诊断 */}
      <section className="dashboard-diag">
        <h3>池级策略诊断</h3>
        <button className="refresh-btn" onClick={handlePoolDiagnose} disabled={diagnosing}>
          {diagnosing ? '诊断中...' : '📊 运行诊断 + 组合回测'}
        </button>
        <p className="diag-note">
          对全池跑4因子打分（趋势/动量排名/波动率/资金流），检验各因子在 5/20/60 日周期上的IC（动量在长周期理论上更有信息量），并跑组合回测（≥65买入、&lt;45清仓、分数定仓位）。
        </p>
        {diagByHorizon && diagByHorizon.length > 0 && (
          <table className="diag-table">
            <thead>
              <tr>
                <th>因子</th>
                {diagByHorizon.map(d => <th key={d.forwardDays}>IC({d.forwardDays}日)</th>)}
              </tr>
            </thead>
            <tbody>
              {['trend', 'momentum', 'volatility', 'moneyFlow', 'total'].map(fid => (
                <tr key={fid}>
                  <td>{factorLabel[fid] ?? fid}</td>
                  {diagByHorizon.map(d => {
                    const f = d.factors.find(x => x.factor === fid)
                    return (
                      <td key={d.forwardDays} style={{ color: icColor(f?.ic ?? 0), fontWeight: 700 }}>
                        {(f?.ic ?? 0).toFixed(3)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {portfolio && portfolio.equityCurve.length > 0 && (
          <div className="portfolio-result">
            <div>阈值打分版（对比）：<b style={{ color: portfolio.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>{(portfolio.totalReturn * 100).toFixed(1)}%</b>（年化 {(portfolio.annualizedReturn * 100).toFixed(1)}%）</div>
            <div>最大回撤 {(portfolio.maxDrawdown * 100).toFixed(1)}% · 夏普 {portfolio.sharpeRatio.toFixed(2)} · 调仓 {portfolio.tradeCount} 次</div>
          </div>
        )}
        {rankingPortfolio && rankingPortfolio.equityCurve.length > 0 && (
          <div className="portfolio-result">
            <div>排名组合（动量+低波·月频）：<b style={{ color: rankingPortfolio.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>{(rankingPortfolio.totalReturn * 100).toFixed(1)}%</b>（年化 {(rankingPortfolio.annualizedReturn * 100).toFixed(1)}%）</div>
            <div>最大回撤 <b style={{ color: 'var(--red)' }}>{(rankingPortfolio.maxDrawdown * 100).toFixed(1)}%</b> · 夏普 {rankingPortfolio.sharpeRatio.toFixed(2)} · 调仓 {rankingPortfolio.tradeCount} 次</div>
          </div>
        )}
      </section>

      {/* 近十日趋势分弹窗 */}
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
                <p className="score-empty">K线数据不足（需≥20天），请先点刷新拉取数据</p>
              ) : (
                recentScores.map((s, i) => (
                  <div key={s.date} className="score-row">
                    <span className="score-date">{s.date}</span>
                    <span className="score-trend">
                      {i < recentScores.length - 1 && (
                        s.score > recentScores[i + 1].score ? '↑' :
                        s.score < recentScores[i + 1].score ? '↓' : '→'
                      )}
                    </span>
                    <span className="score-emoji">{signalEmoji(s.signal)}</span>
                    <span className="score-num" style={{ color: signalColor(s.signal) }}>{s.score}</span>
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
