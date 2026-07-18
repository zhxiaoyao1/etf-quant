import { useState, useEffect } from 'react'
import type { FundNAV } from '../types'
import { fetchFundNAV } from '../data/fundFetcher'
import { saveSetting, getSetting } from '../data/db'
import { signalEmoji, signalLabel, signalColor } from './signalHelpers'
import './FundPicker.css'

interface PortfolioItem {
  code: string
  name: string
  buyDate: string
  amount: number
}

interface ScreeningResult {
  code: string
  latestNAV: number
  latestDate: string
  return1M: number
  return3M: number
  returnYTD: number
  score: number
  signal: 'buy' | 'hold' | 'sell'
}

interface PortfolioDiagnosis {
  code: string
  latestNAV: number | null
  latestDate: string | null
  return1M: number | null
  healthScore: number | null
  estimatedValue: number | null
  alert: string | null
}

function calcReturn(navData: FundNAV[], lookbackDays: number): number {
  if (navData.length < 2) return 0
  const latest = navData[navData.length - 1]
  const idx = Math.max(0, navData.length - 1 - lookbackDays)
  const past = navData[idx]
  if (past.nav === 0) return 0
  return (latest.nav - past.nav) / past.nav
}

function calcYTDReturn(navData: FundNAV[]): number {
  if (navData.length < 2) return 0
  const currentYear = new Date().getFullYear()
  const yearStart = navData.find(d => d.date.startsWith(`${currentYear}-`))
  if (!yearStart || yearStart.nav === 0) return 0
  const latest = navData[navData.length - 1]
  return (latest.nav - yearStart.nav) / yearStart.nav
}

function calcHoldDuration(buyDate: string): string {
  const buy = new Date(buyDate)
  const now = new Date()
  const diffMs = now.getTime() - buy.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 0) return '0天'
  if (days < 30) return `${days}天`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}个月`
  const years = Math.floor(months / 12)
  const remainMonths = months % 12
  return remainMonths > 0 ? `${years}年${remainMonths}个月` : `${years}年`
}

function calcHoldMonths(buyDate: string): number {
  const buy = new Date(buyDate)
  const now = new Date()
  const diffMs = now.getTime() - buy.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30))
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}

export default function FundPicker() {
  // Screening state
  const [fundCode, setFundCode] = useState('')
  const [screeningResult, setScreeningResult] = useState<ScreeningResult | null>(null)
  const [screeningLoading, setScreeningLoading] = useState(false)
  const [screeningError, setScreeningError] = useState('')
  const [screenedHistory, setScreenedHistory] = useState<ScreeningResult[]>([])

  // Portfolio state
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [diagnoses, setDiagnoses] = useState<Map<string, PortfolioDiagnosis>>(new Map())
  const [diagnosing, setDiagnosing] = useState(false)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addCode, setAddCode] = useState('')
  const [addName, setAddName] = useState('')
  const [addDate, setAddDate] = useState(new Date().toISOString().slice(0, 10))
  const [addAmount, setAddAmount] = useState('')

  useEffect(() => {
    getSetting<ScreeningResult[]>('screenedFunds').then(d => {
      if (d) setScreenedHistory(d)
    })
    getSetting<PortfolioItem[]>('portfolio').then(d => {
      if (d) setPortfolio(d)
    })
  }, [])

  async function handleScreen() {
    const code = fundCode.trim()
    if (!code) return
    if (!/^\d{6}$/.test(code)) {
      setScreeningError('请输入6位基金代码')
      return
    }
    setScreeningLoading(true)
    setScreeningError('')
    setScreeningResult(null)
    try {
      const navData = await fetchFundNAV(code)
      if (navData.length === 0) {
        setScreeningError('未找到该基金数据，请检查代码是否正确')
        return
      }
      const latest = navData[navData.length - 1]
      const return1M = calcReturn(navData, 22)
      const return3M = calcReturn(navData, 66)
      const returnYTD = calcYTDReturn(navData)

      let signal: 'buy' | 'hold' | 'sell'
      let score: number
      if (return1M > 0.05) {
        signal = 'buy'
        score = 85
      } else if (return1M < -0.05) {
        signal = 'sell'
        score = 20
      } else {
        signal = 'hold'
        score = 55
      }

      const result: ScreeningResult = {
        code,
        latestNAV: latest.nav,
        latestDate: latest.date,
        return1M,
        return3M,
        returnYTD,
        score,
        signal,
      }
      setScreeningResult(result)

      const updated = [result, ...screenedHistory.filter(f => f.code !== code)].slice(0, 20)
      setScreenedHistory(updated)
      saveSetting('screenedFunds', updated)
    } catch (e) {
      setScreeningError('获取数据失败: ' + (e as Error).message)
    } finally {
      setScreeningLoading(false)
    }
  }

  function handleAddToPortfolio() {
    if (!addCode.trim() || !addName.trim() || !addDate || !addAmount.trim()) return
    if (!/^\d{6}$/.test(addCode.trim())) return
    const amount = parseFloat(addAmount)
    if (isNaN(amount) || amount <= 0) return
    if (portfolio.some(p => p.code === addCode.trim())) {
      return
    }
    const updated = [
      ...portfolio,
      { code: addCode.trim(), name: addName.trim(), buyDate: addDate, amount },
    ]
    setPortfolio(updated)
    saveSetting('portfolio', updated)
    setShowAddForm(false)
    setAddCode('')
    setAddName('')
    setAddDate(new Date().toISOString().slice(0, 10))
    setAddAmount('')
  }

  function handleRemoveFromPortfolio(code: string) {
    const updated = portfolio.filter(p => p.code !== code)
    setPortfolio(updated)
    saveSetting('portfolio', updated)
  }

  async function handleDiagnose() {
    if (portfolio.length === 0) return
    setDiagnosing(true)
    const newDiagnoses = new Map<string, PortfolioDiagnosis>()
    for (const item of portfolio) {
      try {
        const navData = await fetchFundNAV(item.code)
        if (navData.length === 0) {
          newDiagnoses.set(item.code, {
            code: item.code,
            latestNAV: null,
            latestDate: null,
            return1M: null,
            healthScore: null,
            estimatedValue: null,
            alert: '无法获取基金数据',
          })
          continue
        }
        const latest = navData[navData.length - 1]
        const return1M = calcReturn(navData, 22)
        const healthScore = Math.round(Math.max(0, Math.min(100, 50 + return1M * 1000)))

        // Find purchase NAV
        let estimatedValue: number | null = null
        const purchaseEntry = navData.find(d => d.date >= item.buyDate)
        if (purchaseEntry && purchaseEntry.nav > 0) {
          const shares = item.amount / purchaseEntry.nav
          estimatedValue = Math.round(shares * latest.nav * 100) / 100
        }

        // Alert: held > 6 months and recent return negative
        let alert: string | null = null
        const holdMonths = calcHoldMonths(item.buyDate)
        if (holdMonths > 6 && return1M < 0) {
          alert = `持有超${holdMonths}个月且近期收益为负，建议关注`
        }

        newDiagnoses.set(item.code, {
          code: item.code,
          latestNAV: latest.nav,
          latestDate: latest.date,
          return1M,
          healthScore,
          estimatedValue,
          alert,
        })
      } catch {
        newDiagnoses.set(item.code, {
          code: item.code,
          latestNAV: null,
          latestDate: null,
          return1M: null,
          healthScore: null,
          estimatedValue: null,
          alert: '获取基金数据失败',
        })
      }
    }
    setDiagnoses(newDiagnoses)
    setDiagnosing(false)
  }

  // Build a quick lookup of screening results for portfolio items
  const screeningByCode = new Map<string, ScreeningResult>()
  if (screeningResult) screeningByCode.set(screeningResult.code, screeningResult)
  for (const h of screenedHistory) {
    if (!screeningByCode.has(h.code)) screeningByCode.set(h.code, h)
  }

  return (
    <div className="fundpicker">
      <h2>{'选基'}</h2>

      {/* Section 1: Fund Screening */}
      <section className="fundpicker-section">
        <h3>{'基金筛选'}</h3>
        <div className="screening-form">
          <input
            type="text"
            placeholder="输入基金代码 (如 110020)"
            value={fundCode}
            onChange={e => setFundCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleScreen() }}
          />
          <button onClick={handleScreen} disabled={screeningLoading}>
            {screeningLoading ? '查询中...' : '查询'}
          </button>
        </div>

        {screeningError && <div className="fundpicker-error">{screeningError}</div>}

        {screeningResult && (
          <div className="screening-result card">
            <div className="card-header">
              <span className="fund-code-label">{screeningResult.code}</span>
              <span className="fund-date">{screeningResult.latestDate}</span>
            </div>
            <div className="nav-row">
              <span className="nav-label">最新净值</span>
              <span className="nav-value">{screeningResult.latestNAV.toFixed(4)}</span>
            </div>
            <div className="returns-grid">
              <div className="return-item">
                <span className="return-label">近1月</span>
                <span className={`return-value ${screeningResult.return1M >= 0 ? 'positive' : 'negative'}`}>
                  {fmtPct(screeningResult.return1M)}
                </span>
              </div>
              <div className="return-item">
                <span className="return-label">近3月</span>
                <span className={`return-value ${screeningResult.return3M >= 0 ? 'positive' : 'negative'}`}>
                  {fmtPct(screeningResult.return3M)}
                </span>
              </div>
              <div className="return-item">
                <span className="return-label">今年以来</span>
                <span className={`return-value ${screeningResult.returnYTD >= 0 ? 'positive' : 'negative'}`}>
                  {fmtPct(screeningResult.returnYTD)}
                </span>
              </div>
            </div>
            <div className="signal-row">
              <span className="signal-emoji">{signalEmoji(screeningResult.signal)}</span>
              <span className="signal-text" style={{ color: signalColor(screeningResult.signal) }}>
                {signalLabel(screeningResult.signal)}
              </span>
              <span className="signal-score" style={{ color: signalColor(screeningResult.signal) }}>
                {screeningResult.score}分
              </span>
            </div>
          </div>
        )}

        {screenedHistory.length > 0 && (
          <div className="screening-history">
            <h4>最近查询</h4>
            {screenedHistory.slice(0, 5).map(item => (
              <div
                key={item.code}
                className="history-item card"
                onClick={() => {
                  setFundCode(item.code)
                  handleScreen()
                }}
              >
                <span className="history-code">{item.code}</span>
                <span className="history-nav">净值 {item.latestNAV.toFixed(4)}</span>
                <span className={`history-return ${item.return1M >= 0 ? 'positive' : 'negative'}`}>
                  {fmtPct(item.return1M)}
                </span>
                <span style={{ color: signalColor(item.signal) }}>
                  {signalEmoji(item.signal)} {signalLabel(item.signal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: My Portfolio */}
      <section className="fundpicker-section">
        <div className="section-header">
          <h3>{'我的持仓'}</h3>
          <div className="section-actions">
            <button
              className="action-btn"
              onClick={handleDiagnose}
              disabled={diagnosing || portfolio.length === 0}
            >
              {diagnosing ? '诊断中...' : '刷新估值'}
            </button>
            <button
              className="action-btn"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? '取消' : '添加持仓'}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="add-form card">
            <input
              type="text"
              placeholder="基金代码 (6位)"
              value={addCode}
              onChange={e => setAddCode(e.target.value)}
              maxLength={6}
            />
            <input
              type="text"
              placeholder="基金名称"
              value={addName}
              onChange={e => setAddName(e.target.value)}
            />
            <input
              type="date"
              value={addDate}
              onChange={e => setAddDate(e.target.value)}
            />
            <input
              type="number"
              placeholder="买入金额 (元)"
              value={addAmount}
              onChange={e => setAddAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <button className="add-btn" onClick={handleAddToPortfolio}>
              确认添加
            </button>
          </div>
        )}

        {portfolio.length === 0 && (
          <div className="empty-state">
            <p>暂无持仓</p>
            <p className="sub">点击"添加持仓"开始记录</p>
          </div>
        )}

        {portfolio.map(item => {
          const diag = diagnoses.get(item.code)
          const scr = screeningByCode.get(item.code)
          return (
            <div key={item.code} className="portfolio-card card">
              <div className="card-header">
                <div>
                  <div className="fund-name">{item.name}</div>
                  <div className="fund-code">{item.code}</div>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => handleRemoveFromPortfolio(item.code)}
                >
                  移除
                </button>
              </div>
              <div className="portfolio-meta">
                <div className="meta-item">
                  <span className="meta-label">持有时间</span>
                  <span className="meta-value">{calcHoldDuration(item.buyDate)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">买入金额</span>
                  <span className="meta-value">{item.amount.toLocaleString()}元</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">买入日期</span>
                  <span className="meta-value">{item.buyDate}</span>
                </div>
              </div>

              {diag && (
                <div className="diagnosis-result">
                  <div className="diag-row">
                    <span className="meta-label">最新净值</span>
                    <span className="meta-value">
                      {diag.latestNAV != null ? diag.latestNAV.toFixed(4) : '--'}
                    </span>
                    {diag.latestDate && <span className="diag-date">{diag.latestDate}</span>}
                  </div>
                  <div className="diag-row">
                    <span className="meta-label">近1月收益</span>
                    <span className={`meta-value ${(diag.return1M ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                      {diag.return1M != null ? fmtPct(diag.return1M) : '--'}
                    </span>
                  </div>
                  <div className="diag-row">
                    <span className="meta-label">估算市值</span>
                    <span className="meta-value">
                      {diag.estimatedValue != null ? `${diag.estimatedValue.toLocaleString()}元` : '--'}
                    </span>
                  </div>
                  {diag.healthScore != null && (
                    <div className="health-row">
                      <span className="meta-label">健康度</span>
                      <span
                        className="health-score"
                        style={{
                          color: diag.healthScore >= 80
                            ? 'var(--green)'
                            : diag.healthScore >= 40
                              ? 'var(--yellow)'
                              : 'var(--red)',
                        }}
                      >
                        {diag.healthScore}分
                      </span>
                      <div className="health-bar-track">
                        <div
                          className="health-bar-fill"
                          style={{
                            width: `${diag.healthScore}%`,
                            background: diag.healthScore >= 80
                              ? 'var(--green)'
                              : diag.healthScore >= 40
                                ? 'var(--yellow)'
                                : 'var(--red)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {diag.alert && (
                    <div className="diag-alert">{diag.alert}</div>
                  )}
                </div>
              )}

              {!diag && scr && (
                <div className="screening-hint">
                  <span>已查询近1月收益: </span>
                  <span className={scr.return1M >= 0 ? 'positive' : 'negative'}>
                    {fmtPct(scr.return1M)}
                  </span>
                  <span className="hint-text">（点击刷新估值获取完整诊断）</span>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
